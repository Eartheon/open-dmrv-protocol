import { randomUUID } from 'node:crypto';
import { pool, transaction } from './db.ts';
import { projectFor, currentResources, persistResource, audit } from './repository.ts';
import { prepareAsset, retrieveAsset, retrieveResource } from './assets.ts';
import { origin } from './config.ts';
import {
    uid,
    timestamp,
    sign,
    verifySigned,
    makeEnvelope,
    validateEnvelopeShape,
    reference,
    digest,
    canonicalize,
    ack,
    calculate,
    fail,
    ProtocolError,
    clone,
} from './protocol.ts';
import { roles, party, agent, methodology, actionRole, outputKey, areaHa } from '../lib/model.ts';
import { journeySteps, stageIndex, roleForStep } from '../lib/journey.ts';
import { semanticFields } from '../lib/semantics.ts';
import { observationRequest, modalitiesOf, defaultSamples, satelliteProfile, monitoringProfile } from '../lib/monitoring.ts';
import { monitoredEvidence, assessEvidence, evidenceStatement } from './monitoring.ts';
import type { Doc, RoleId, Action } from '../lib/model.ts';

export async function prepareRequest(projectId: string, profile: RoleId, action: Action, values: Doc = {}, overrides: Doc = {}) {
    const p = await projectFor(projectId, profile);
    if (actionRole[action] !== profile) fail('ROLE_NOT_AUTHORISED', 'Enter the responsible application before signing.', 403, action);
    if (p.next_action !== action)
        fail('STEP_NOT_READY', 'This is not the current project step. Use a revision request to revisit a completed step.', 409, p.next_action);
    const resources = await currentResources(projectId);
    const subject = (await pool().query('SELECT * FROM dmrv.subjects WHERE project_id=$1', [projectId])).rows[0];
    const inputs = Object.fromEntries(
        Object.entries(resources)
            .filter(([step]) => stageIndex(step) < stageIndex(action))
            .map(([step, row]) => [step, overrides[step] ?? (row as Doc).document])
    );
    const base: Doc = {
        activityId: p.activity_id,
        subjectId: subject.id,
        inputObjects: inputs,
        inputResources: Object.entries(inputs).map(([step, d]) => ({ action: step, ...reference(d as Doc) })),
        revisionReason: typeof values.revisionReason === 'string' ? values.revisionReason.slice(0, 500) : p.correction?.message || null,
    };
    if (action === 'register')
        base.registrations = [
            {
                kind: 'Activity',
                object: {
                    id: p.activity_id,
                    name: p.name,
                    subjectId: subject.id,
                    participants: roles.map((r) => ({ partyId: party(r.id), agentId: agent(r.id), role: r.role })),
                    methodologyReference: { id: methodology.id, version: methodology.version },
                },
            },
            { kind: 'MonitoredSubject', object: { id: subject.id, name: subject.name, geometry: subject.geometry, crs: subject.crs } },
            { kind: 'SubjectAuthorisation', object: inputs.consent },
        ];
    if (action === 'monitor') base.observationRequest = observationRequest(subject, party('measurement'), values);
    if (action === 'report') {
        base.claimType = 'ObservationClaim';
        base.evidence = resources.monitor ? [reference(resources.monitor.document)] : [];
        base.methodologyReference = { id: methodology.id, version: methodology.version };
        base.claimDraft = { netTCO2e: values.netTCO2e ?? null };
    }
    if (action === 'verify') {
        base.claim = resources.report ? reference(resources.report.document) : null;
        base.verificationScope = ['authenticity', 'evidenceIntegrity', modalitiesOf(resources.monitor?.document || {}).manualStudy ? 'calculation' : 'satelliteObservation', 'demoFunctionProfile'];
        base.procedure = 'urn:open-dmrv:demo:verification-procedure:v2';
    }
    if (action === 'attest') {
        base.claim = resources.report ? reference(resources.report.document) : null;
        base.verificationResult = resources.verify ? reference(resources.verify.document) : null;
        base.attestationPolicy = 'urn:open-dmrv:demo:attestation-policy:v1';
    }
    if (overrides.assetOverrides) base.assetOverrides = overrides.assetOverrides;
    return { endpoint: '/' + action, envelope: makeEnvelope(action, profile, p, base) };
}
export { defaultSamples };
export async function acceptRequest(action: Action, profile: RoleId, envelope: Doc, idempotency?: string) {
    validateEnvelopeShape(envelope, action, profile);
    await verifySigned(envelope, profile, 'authentication', envelope.context.messageId);
    if (idempotency && idempotency !== envelope.context.messageId)
        fail('INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key must equal context.messageId.', 400, action);
    return transaction(async (db) => {
        const p = await projectFor(envelope.context.projectId, profile, db, true);
        const existing = (await db.query('SELECT digest,acknowledgement FROM dmrv.messages WHERE message_id=$1', [envelope.context.messageId])).rows[0];
        if (existing) {
            if (existing.digest !== digest(envelope)) fail('CONFLICTING_MESSAGE', 'This message ID was already accepted with different bytes.', 409, action);
            return existing.acknowledgement;
        }
        if (action === 'monitor' && envelope.message.observationRequest?.semanticProfile !== monitoringProfile)
            fail('ONTOLOGY_PROFILE_REQUIRED', 'New monitoring requests must declare the supported ontology profile and selected observation modalities.', 400, 'monitor');
        if (p.pending_message_id) fail('BUSY', 'The previous request is still awaiting its callback.', 409, p.next_action);
        if (
            p.next_action !== action ||
            p.revision !== envelope.context.projectRevision ||
            p.transaction_id !== envelope.context.transactionId ||
            envelope.message.activityId !== p.activity_id
        )
            fail('CONFLICTING_REVISION', 'The project changed after this request was signed. Refresh and sign the current revision.', 409, p.next_action);
        const response = ack();
        await db.query(
            'INSERT INTO dmrv.messages(message_id,project_id,transaction_id,action,direction,sender,recipient,envelope,canonical_envelope,digest,endpoint,acknowledgement,http_status,expected_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
            [
                envelope.context.messageId,
                p.id,
                p.transaction_id,
                action,
                'request',
                party(profile),
                envelope.context.receiver.partyId,
                envelope,
                canonicalize(envelope),
                digest(envelope),
                '/' + action,
                response,
                202,
                p.revision,
            ]
        );
        await db.query('INSERT INTO dmrv.outbox(id,kind,message_id) VALUES($1,$2,$3)', [randomUUID(), 'process', envelope.context.messageId]);
        await db.query('UPDATE dmrv.projects SET pending_message_id=$2,updated_at=now() WHERE id=$1', [p.id, envelope.context.messageId]);
        await audit(db, p.id, profile, 'request_accepted', { action, messageId: envelope.context.messageId, httpStatus: 202 });
        return response;
    });
}
async function validateInputs(project: Doc, envelope: Doc, current: Doc) {
    const action = envelope.context.action as Action,
        inputs = envelope.message.inputObjects || {};
    for (const step of journeySteps.filter((s) => stageIndex(s.id) < stageIndex(action))) {
        const row = current[step.id],
            candidate = inputs[step.id];
        if (!row || !candidate)
            fail('MISSING_INPUT', 'A required signed ' + step.label.toLowerCase() + ' object is missing.', 422, step.id === 'consent' ? 'register' : step.id);
        try {
            await verifySigned(candidate, step.id === 'register' ? 'registrar' : step.role);
        } catch (error) {
            if (error instanceof ProtocolError) error.retryFrom = step.id === 'consent' ? 'register' : step.id;
            throw error;
        }
        if (candidate.id !== row.id || digest(candidate) !== row.digest)
            fail(
                'REFERENCE_MISMATCH',
                'The submitted ' + step.id + ' object is not the current protected revision.',
                422,
                step.id === 'consent' ? 'register' : step.id
            );
        if (candidate.activityId !== project.activity_id) fail('SUBJECT_MISMATCH', 'The input belongs to a different registered activity.', 422, 'register');
    }
    for (const [assetId, content] of Object.entries(envelope.message.assetOverrides || {})) {
        const asset = (await pool().query('SELECT * FROM dmrv.assets WHERE id=$1 AND project_id=$2', [assetId, project.id])).rows[0];
        if (!asset) fail('REFERENCE_MISMATCH', 'The substituted asset is not registered for this project.', 422, 'monitor');
        if (typeof content !== 'string' || 'sha256:' + digestRaw(content) !== asset.digest)
            fail(
                'DIGEST_MISMATCH',
                'The supplied asset bytes do not match their signed AssetReference.',
                422,
                asset.custodian.endsWith('/standards') ? 'register' : 'monitor'
            );
    }
}
async function loadEvidence(project: Doc, current: Doc, profile: RoleId, envelope: Doc) {
    const reg = await retrieveResource(current.register.id, profile, current.register.digest);
    await verifySigned(reg, 'registrar');
    const manifest = await retrieveResource(current.monitor.id, profile, current.monitor.digest);
    await verifySigned(manifest, 'measurement');
    const content: Record<string, string | Buffer> = {};
    for (const asset of [...manifest.assets, reg.methodologyReference.asset]) {
        let raw = await retrieveAsset(asset, profile, project.id);
        if (envelope.message.assetOverrides?.[asset.id] !== undefined) {
            raw = envelope.message.assetOverrides[asset.id];
            if (typeof raw !== 'string' || 'sha256:' + digestRaw(raw) !== 'sha256:' + asset.integrity.digest)
                fail('DIGEST_MISMATCH', 'The submitted asset content no longer matches its signed AssetReference.', 422, 'monitor');
        }
        content[asset.name] = raw;
    }
    const method = JSON.parse(content['methodology-profile.json'].toString());
    if (method.id !== 'urn:open-dmrv:demo:soil-stock:v1' || method.version !== '1.0')
        fail('METHODOLOGY_MISMATCH', 'The retrieved calculation profile does not match registration.', 422, 'register');
    return { manifest, reg, content, ...assessEvidence(manifest, content, Number(reg.subject.spatial.areaHa)) };
}
import { hash } from './protocol.ts';
const digestRaw = (value: string) => hash(value).toString('hex');
async function buildOutput(project: Doc, envelope: Doc, current: Doc): Promise<{ draft: Doc; assets: ReturnType<typeof prepareAsset>[] }> {
    const action = envelope.context.action as Action,
        profile = actionRole[action];
    await validateInputs(project, envelope, current);
    const subject = (await pool().query('SELECT * FROM dmrv.subjects WHERE project_id=$1', [project.id])).rows[0];
    const base: Doc = { id: uid(), activityId: project.activity_id, issuedAt: timestamp() };
    const subjectDoc = {
        id: subject.id,
        type: 'MonitoredSubject',
        name: subject.name,
        spatial: { geometry: subject.geometry, crs: subject.crs, areaHa: Number(subject.area_ha) },
    };
    const assets: ReturnType<typeof prepareAsset>[] = [];
    if (action === 'register') {
        const method = prepareAsset(
            project.id,
            'methodology-profile.json',
            'application/json',
            JSON.stringify(
                {
                    id: 'urn:open-dmrv:demo:soil-stock:v1',
                    version: '1.0',
                    type: 'MethodologyReference',
                    standardsAuthority: 'Gold Standard',
                    framework: { id: methodology.id, version: methodology.version, document: methodology.document },
                    activityModuleReference: 'https://globalgoals.goldstandard.org/402-4-luf-agr-am-soc-module-zero-tillage/',
                    calculationProfile:
                        'Illustrative fixed-depth SOC stock difference; equal sample weights, emissions 0.3 tCO2e/ha, leakage 0.1 tCO2e/ha, buffer 20%.',
                    satelliteObservationProfile: { id: satelliteProfile, version: '1.0', metric: 'Synthetic clear-scene coverage = 100 - cloud cover; no soil-carbon quantification.' },
                    certificationEligible: false,
                    limitations: methodology.limitation,
                },
                null,
                2
            ),
            'standards'
        );
        assets.push(method);
        return {
            draft: {
                ...base,
                type: 'RegistrationResult',
                registrationResults: envelope.message.registrations.map((r: Doc) => ({
                    kind: r.kind,
                    registrationId: r.object.id || current.consent.id,
                    status: 'accepted',
                    statusEndpoint: origin + '/api/projects/' + project.id,
                })),
                subject: subjectDoc,
                authorisation: reference(current.consent.document),
                participants: roles.map((r) => ({ partyId: party(r.id), agentId: agent(r.id), role: r.role })),
                methodologyReference: { ...methodology, asset: method.descriptor },
                functionProfile: { id: 'urn:open-dmrv:demo:monitoring-quality:v1', version: '1.0',
                    manualStudy: { appliesWhen: 'modalities.manualStudy', minimumSamples: 3 },
                    satelliteCapture: { appliesWhen: 'modalities.satelliteCapture', maxCloudCoverPercent: 20, syntheticOnly: true } },
            },
            assets,
        };
    }
    if (action === 'monitor') {
        await retrieveAsset(current.register.document.methodologyReference.asset, profile, project.id);
        return monitoredEvidence(project, subject, current.register.document, envelope, base);
    }
    const evidence = await loadEvidence(project, current, profile, envelope);
    const manual = evidence.modalities.manualStudy;
    const method = manual ? evidence.reg.methodologyReference : { id: satelliteProfile, version: '1.0', asset: evidence.reg.methodologyReference.asset,
        limitation: 'Synthetic image observation only; no carbon removal is quantified.' };
    if (action === 'report') {
        return { draft: {
            ...base, ...evidence.semantics, type: ['Claim', 'ObservationClaim'], modalities: evidence.modalities,
            claimKind: manual ? 'soil-carbon' : 'satellite-observation', issuer: party(profile), subject: { id: subject.id, type: 'MonitoredSubject' },
            spatial: subjectDoc.spatial, temporal: evidence.manifest.temporal,
            statement: evidenceStatement(evidence, envelope.message.claimDraft?.netTCO2e ?? null),
            evidence: [{ manifestId: evidence.manifest.id, ...reference(evidence.manifest) }], methodologyReference: method,
            conformsTo: [manual ? 'urn:open-dmrv:demo:soil-stock:v1' : satelliteProfile],
            quality: { ...(evidence.calculation ? { sampleCount: evidence.calculation.samples } : {}), ...(evidence.capture ? { cloudCoverPercent: evidence.capture.snapshot.cloudCoverPercent } : {}) },
            lineage: { derivedFrom: evidence.manifest.assets.map((a: Doc) => a.id), process: manual ? 'urn:open-dmrv:demo:fixed-depth-calculation:v1' : satelliteProfile },
            limitations: [manual ? methodology.limitation : 'Synthetic image observation; no soil-carbon measurement or credit is claimed.',
                evidence.modalities.satelliteCapture ? 'The satellite image is synthetic. No SOC estimate is inferred from imagery.' : 'No satellite capture was selected or used.',
                'All evidence is educational; no programme certification is implied.'],
        }, assets };
    }
    const claim = await retrieveResource(current.report.id, profile, current.report.digest);
    await verifySigned(claim, 'reporter');
    const findings: Doc[] = [
        { code: 'SIGNATURES_VALID', status: 'passed', message: 'All upstream signatures, key assignments and revision digests are valid.' },
        { code: 'ASSET_INTEGRITY_VALID', status: 'passed', message: 'Selected evidence and methodology were retrieved with signed grants; exact byte hashes match.' },
    ];
    if (claim.issuer === party(profile)) fail('INDEPENDENCE_REQUIREMENT_FAILED', 'The reporter and verifier must be different accountable parties.', 422, 'register');
    if (claim.subject.id !== subject.id || digest(claim.spatial) !== digest(subjectDoc.spatial) || claim.evidence[0].digest !== current.monitor.digest)
        fail('REFERENCE_MISMATCH', 'The claim does not bind the current subject and monitoring revision.', 422, 'report');
    const expectedStatement = evidenceStatement(evidence);
    if (digest(claim.statement) !== digest(expectedStatement))
        fail(manual ? 'CALCULATION_MISMATCH' : 'OBSERVATION_MISMATCH', 'The signed claim differs from the result reproduced from its selected evidence.', 422, 'report', '/statement/object');
    if (evidence.manifest.semanticProfile && (digest(semanticFields(claim)) !== digest(evidence.semantics) || digest(claim.modalities ?? null) !== digest(evidence.modalities)))
        fail('ONTOLOGY_PROFILE_MISMATCH', 'The claim does not preserve the monitoring ontology relationships and modalities.', 422, 'report');
    findings.push({ code: manual ? 'CALCULATION_REPRODUCED' : 'OBSERVATION_REPRODUCED', status: 'passed', message: manual ? 'The independent soil-carbon calculation matches.' : 'Synthetic clear-scene coverage matches capture metadata and the verified image fixture; no soil carbon is inferred.' });
    if (evidence.capture && evidence.capture.snapshot.cloudCoverPercent > 20)
        fail('QUALITY_INSUFFICIENT', 'The satellite capture exceeds the demo Function Profile limit of 20% cloud cover.', 422, 'monitor');
    findings.push({ code: 'FUNCTION_PROFILE_MET', status: 'passed', message: 'The checks applicable to the selected monitoring modalities meet the demonstration profile.' });
    const qualifications = ['All observations are synthetic.', manual ? 'Assessment covers the demo soil calculation and selected evidence; Gold Standard certification conformance was not assessed.' : 'Assessment covers synthetic image provenance, integrity and coverage only. No soil-carbon measurement or carbon credit is claimed.'];
    if (action === 'verify') return { draft: {
        ...base, type: 'VerificationResult', claim: reference(claim), verifier: party(profile), verificationScope: envelope.message.verificationScope,
        procedure: envelope.message.procedure, outcome: 'verified_with_qualifications', findings, qualifications, verifiedAt: timestamp(),
        modalities: evidence.modalities, observationSemantics: evidence.semantics,
        ...(evidence.calculation ? { reproducedCalculation: evidence.calculation } : { reproducedObservation: expectedStatement.object }),
    }, assets };
    const verification = await retrieveResource(current.verify.id, profile, current.verify.digest);
    await verifySigned(verification, 'verifier');
    if (!['verified', 'verified_with_qualifications'].includes(verification.outcome) || verification.claim.digest !== current.report.digest || verification.verifier === claim.issuer)
        fail('ATTESTATION_BLOCKED', 'Only an accepted independent verification bound to this exact claim may be endorsed.', 422, 'verify');
    return { draft: {
        ...base, type: 'Attestation', authority: party(profile), modalities: evidence.modalities,
        observationSemantics: evidence.semantics, assuredStatement: claim.statement,
        subject: subjectDoc, claim: reference(claim), verificationResult: reference(verification), methodologyReference: method,
        decision: 'endorsed_with_qualifications', policy: { id: 'urn:open-dmrv:demo:attestation-policy:v1', accepts: ['verified', 'verified_with_qualifications'] },
        qualifications: verification.qualifications, scope: manual ? 'Educational programme endorsement only. No Gold Standard certification or credit issuance.' : 'Educational synthetic-image observation endorsement only. No carbon removal or credit issuance.',
        effectiveFrom: timestamp(), effectiveUntil: new Date(Date.now() + 365 * 86400000).toISOString(),
    }, assets };
}
export async function processMessage(messageId: string) {
    const row = (await pool().query("SELECT * FROM dmrv.messages WHERE message_id=$1 AND direction='request'", [messageId])).rows[0];
    if (!row || row.status !== 'accepted') return;
    const p = await projectFor(row.project_id, actionRole[row.action as Action]),
        current = await currentResources(p.id);
    let output: Awaited<ReturnType<typeof buildOutput>> | null = null,
        error: ProtocolError | null = null;
    try {
        output = await buildOutput(p, row.envelope, current);
    } catch (e) {
        if (!(e instanceof ProtocolError)) throw e;
        error = e;
    }
    await transaction(async (db) => {
        const locked = await projectFor(p.id, actionRole[row.action as Action], db, true);
        const request = (await db.query('SELECT * FROM dmrv.messages WHERE message_id=$1 FOR UPDATE', [messageId])).rows[0];
        if (request.status !== 'accepted') return;
        if (locked.revision !== request.expected_revision) {
            error = new ProtocolError('CONFLICTING_REVISION', 'Project changed while the request was processing.', 409, locked.next_action);
            output = null;
        }
        let document: Doc | null = null;
        if (error && row.action === 'verify')
            output = {
                draft: {
                    id: uid(),
                    type: 'VerificationResult',
                    activityId: p.activity_id,
                    claim: current.report ? reference(current.report.document) : null,
                    verifier: party('verifier'),
                    verificationScope: ['authenticity', 'evidenceIntegrity', 'calculation', 'demoFunctionProfile'],
                    procedure: 'urn:open-dmrv:demo:verification-procedure:v2',
                    outcome: ['EVIDENCE_UNAVAILABLE', 'ACCESS_DENIED', 'ACCESS_GRANT_EXPIRED'].includes(error.code) ? 'unable_to_verify' : 'changes_requested',
                    findings: [{ status: 'failed', code: error.code, message: error.message, repeat: error.retryFrom, pointer: error.pointer }],
                    verifiedAt: timestamp(),
                },
                assets: [],
            };
        if (output) {
            for (const a of output.assets)
                await db.query(
                    'INSERT INTO dmrv.assets(id,project_id,name,media_type,custodian,relative_path,digest,size_bytes,descriptor,descriptor_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
                    [a.id, p.id, a.name, a.mediaType, a.custodian, a.relativePath, a.digest, a.sizeBytes, a.descriptor, a.descriptorDigest]
                );
            document = await persistResource(
                db,
                locked,
                row.action,
                output.draft,
                row.action === 'register' ? 'registrar' : actionRole[row.action as Action],
                row.envelope.message.revisionReason || undefined,
                Object.values(current).map((r: any) => ({ id: r.id, digest: r.digest, relation: 'input' }))
            );
            for (const a of output.assets) await db.query('UPDATE dmrv.assets SET manifest_id=$2 WHERE id=$1', [a.id, document.id]);
        }
        const next = error ? error.retryFrom : journeySteps[stageIndex(row.action) + 1]?.id || 'complete';
        const problem = error
            ? { code: error.code, message: error.message, retryFrom: next, resourceId: current[next]?.id || null, pointer: error.pointer }
            : null;
        const message: Doc = {
            status: error ? 'failed' : 'completed',
            completedAt: timestamp(),
            ...(document ? { [outputKey[row.action as Action]]: row.action === 'register' ? document : document } : {}),
            ...(problem ? { error: { ...problem, retryable: true } } : {}),
        };
        const callbackId = uid(),
            signer = row.action === 'register' ? 'registrar' : actionRole[row.action as Action];
        const callback = sign(
            {
                context: {
                    ...row.envelope.context,
                    action: 'on_' + row.action,
                    messageId: callbackId,
                    correlationId: messageId,
                    timestamp: timestamp(),
                    sender: { partyId: party(signer), agentId: agent(signer) },
                    receiver: row.envelope.context.sender,
                },
                message,
            },
            signer,
            'authentication',
            callbackId
        );
        await db.query(
            'INSERT INTO dmrv.messages(message_id,project_id,transaction_id,action,direction,correlation_id,sender,recipient,envelope,canonical_envelope,digest,endpoint,acknowledgement,http_status,status,business_outcome,error,result_resource_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)',
            [
                callbackId,
                p.id,
                p.transaction_id,
                'on_' + row.action,
                'callback',
                messageId,
                party(signer),
                row.sender,
                callback,
                canonicalize(callback),
                digest(callback),
                '/on_' + row.action,
                ack(),
                200,
                'pending',
                message.status,
                problem,
                document?.id || null,
            ]
        );
        await db.query('INSERT INTO dmrv.callback_deliveries(message_id,request_id,callback_url) VALUES($1,$2,$3)', [
            callbackId,
            messageId,
            row.envelope.context.callbackUri,
        ]);
        await db.query('INSERT INTO dmrv.outbox(id,kind,message_id) VALUES($1,$2,$3)', [randomUUID(), 'callback', callbackId]);
        await db.query('UPDATE dmrv.messages SET status=$2,business_outcome=$3,error=$4,result_resource_id=$5,completed_at=now() WHERE message_id=$1', [
            messageId,
            'processed',
            message.status,
            problem,
            document?.id || null,
        ]);
        await db.query('UPDATE dmrv.projects SET next_action=$2,correction=$3,revision=revision+1,updated_at=now() WHERE id=$1', [p.id, next, problem]);
        await audit(db, p.id, signer, error ? 'action_failed' : 'resource_signed', {
            action: row.action,
            resourceId: document?.id || null,
            callbackId,
            ...(problem || {}),
        });
    });
}
export async function acceptCallback(action: Action, body: Doc) {
    const c = body?.context;
    if (!c || c.action !== 'on_' + action || !c.correlationId) fail('INVALID_CALLBACK', 'Callback action or correlation ID is invalid.', 400, action);
    await verifySigned(body, action === 'register' ? 'registrar' : actionRole[action], 'authentication', c.messageId);
    return transaction(async (db) => {
        const callback = (await db.query("SELECT * FROM dmrv.messages WHERE message_id=$1 AND direction='callback' FOR UPDATE", [c.messageId])).rows[0];
        const request = (await db.query("SELECT * FROM dmrv.messages WHERE message_id=$1 AND direction='request'", [c.correlationId])).rows[0];
        if (
            !callback ||
            !request ||
            callback.correlation_id !== request.message_id ||
            request.action !== action ||
            callback.project_id !== request.project_id ||
            c.transactionId !== request.transaction_id ||
            c.receiver?.partyId !== request.sender
        )
            fail('UNEXPECTED_CALLBACK', 'Callback does not correspond to the registered request.', 400, action);
        if (callback.digest !== digest(body)) fail('CONFLICTING_MESSAGE', 'This callback ID was reused with different signed content.', 409, action);
        if (callback.status === 'delivered') return callback.acknowledgement;
        await db.query("UPDATE dmrv.messages SET status='delivered',completed_at=now() WHERE message_id=$1", [c.messageId]);
        await db.query("UPDATE dmrv.callback_deliveries SET status='delivered',delivered_at=now(),last_http_status=200,last_response=$2 WHERE message_id=$1", [
            c.messageId,
            ack(),
        ]);
        await db.query('UPDATE dmrv.projects SET pending_message_id=NULL,updated_at=now() WHERE id=$1 AND pending_message_id=$2', [
            request.project_id,
            request.message_id,
        ]);
        await audit(db, request.project_id, 'callback-receiver', 'callback_acknowledged', {
            endpoint: '/on_' + action,
            messageId: c.messageId,
            correlationId: c.correlationId,
            httpStatus: 200,
        });
        return ack();
    });
}
