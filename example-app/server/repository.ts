import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db.ts';
import { sign, reference, uid, timestamp, digest, canonicalize, fail } from './protocol.ts';
import { roles, party, parcels, areaHa } from '../lib/model.ts';
import { journeySteps, outputType, roleForStep, stageIndex } from '../lib/journey.ts';
import type { Doc, RoleId } from '../lib/model.ts';

export async function projectFor(id: string, profile: RoleId, db?: PoolClient, lock = false) {
    if (!/^[0-9a-f-]{36}$/.test(id || '')) fail('INVALID_PROJECT', 'Invalid project identifier.', 400, 'register');
    const result = await (db || pool()).query(
        `SELECT p.* FROM dmrv.projects p JOIN dmrv.project_members m ON m.project_id=p.id WHERE p.id=$1 AND m.party_id=$2 ${lock ? 'FOR UPDATE OF p' : ''}`,
        [id, party(profile)]
    );
    if (!result.rows[0]) fail('PROJECT_NOT_FOUND', 'This project is unavailable to the selected profile.', 404, 'register');
    return result.rows[0];
}
export async function currentResources(projectId: string, db?: PoolClient) {
    const rows = (await (db || pool()).query("SELECT * FROM dmrv.resources WHERE project_id=$1 AND status='active' ORDER BY created_at", [projectId])).rows;
    return Object.fromEntries(rows.map((r) => [r.action, r]));
}
export async function persistResource(db: PoolClient, project: Doc, action: string, document: Doc, issuer: RoleId, reason?: string, refs: Doc[] = []) {
    const previous = (await db.query('SELECT * FROM dmrv.resources WHERE project_id=$1 AND action=$2 ORDER BY version DESC LIMIT 1', [project.id, action]))
        .rows[0];
    const version = (previous?.version || 0) + 1;
    const objectId = document.id || uid();
    const draft = {
        ...document,
        id: objectId,
        issuedAt: document.issuedAt || timestamp(),
        version,
        statusEndpoint: '/api/status/' + encodeURIComponent(objectId),
        ...(previous ? { revisionOf: previous.id, supersedes: previous.digest, revisionReason: reason || 'Corrected submission after review.' } : {}),
    };
    const signed = sign(draft, issuer),
        documentDigest = digest(signed);
    if (previous) {
        await db.query("UPDATE dmrv.resources SET status='superseded' WHERE id=$1", [previous.id]);
        await db.query('INSERT INTO dmrv.resource_status_events(resource_id,status,reason,superseded_by) VALUES($1,$2,$3,$4)', [
            previous.id,
            'superseded',
            reason || 'New revision',
            signed.id,
        ]);
    }
    await db.query(
        'INSERT INTO dmrv.resources(id,project_id,action,kind,version,issuer,document,canonical_document,digest,revision_of,supersedes_digest,revision_reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [
            signed.id,
            project.id,
            action,
            outputType[action] || document.type,
            version,
            party(issuer),
            signed,
            canonicalize(signed),
            documentDigest,
            previous?.id || null,
            previous?.digest || null,
            previous ? draft.revisionReason : null,
        ]
    );
    await db.query('INSERT INTO dmrv.resource_status_events(resource_id,status,reason) VALUES($1,$2,$3)', [
        signed.id,
        'active',
        reason || 'Initial submission',
    ]);
    for (const ref of refs)
        await db.query('INSERT INTO dmrv.resource_references(resource_id,target_id,target_digest,relation) VALUES($1,$2,$3,$4)', [
            signed.id,
            ref.id,
            ref.digest,
            ref.relation || 'derivedFrom',
        ]);
    const later = journeySteps.slice(stageIndex(action) + 1).map((s) => s.id);
    const suspended = (
        await db.query("UPDATE dmrv.resources SET status='suspended' WHERE project_id=$1 AND action=ANY($2::text[]) AND status='active' RETURNING id", [
            project.id,
            later,
        ])
    ).rows;
    for (const old of suspended)
        await db.query('INSERT INTO dmrv.resource_status_events(resource_id,status,reason) VALUES($1,$2,$3)', [
            old.id,
            'suspended',
            'Upstream revision requires renewed assurance',
        ]);
    return signed;
}
export async function createProject(name: string, parcelId: string, profile: RoleId) {
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 120)
        fail('INVALID_PROJECT_NAME', 'Use a project name between 2 and 120 characters.', 400, 'register');
    const parcel = parcels.find((p) => p.id === parcelId);
    if (!parcel) fail('INVALID_SUBJECT', 'Select a demonstration field.', 400, 'register');
    const projectId = randomUUID();
    await transaction(async (db) => {
        await db.query('INSERT INTO dmrv.projects(id,activity_id,transaction_id,name,domain,created_by,parcel_id) VALUES($1,$2,$3,$4,$5,$6,$7)', [
            projectId,
            uid(),
            uid(),
            name.trim(),
            'carbon',
            party(profile),
            parcelId,
        ]);
        await db.query('INSERT INTO dmrv.subjects(id,project_id,name,geometry,area_ha) VALUES($1,$2,$3,$4,$5)', [
            'urn:open-dmrv:subject:' + projectId,
            projectId,
            parcel!.name,
            parcel!.geometry,
            areaHa(parcel!.geometry),
        ]);
        for (const r of roles) await db.query('INSERT INTO dmrv.project_members(project_id,party_id,role) VALUES($1,$2,$3)', [projectId, party(r.id), r.role]);
        await audit(db, projectId, profile, 'project_created', { name: name.trim(), domain: 'carbon' });
    });
    return { id: projectId };
}
export async function authorise(projectId: string, profile: RoleId) {
    if (profile !== 'controller') fail('ROLE_NOT_AUTHORISED', 'Only the land steward may authorise the subject.', 403, 'consent');
    return transaction(async (db) => {
        const p = await projectFor(projectId, profile, db, true);
        if (p.pending_message_id) fail('BUSY', 'Wait for the outstanding callback.', 409, 'consent');
        if (p.next_action !== 'consent') fail('STEP_NOT_READY', 'Authorisation is not the current project step.', 409, p.next_action);
        const subject = (await db.query('SELECT * FROM dmrv.subjects WHERE project_id=$1', [p.id])).rows[0];
        const consent = await persistResource(
            db,
            p,
            'consent',
            {
                id: uid(),
                type: 'SubjectAuthorisation',
                controller: party(profile),
                subject: { id: subject.id, geometry: subject.geometry },
                activityId: p.activity_id,
                purpose: 'Educational soil-carbon MRV; fictional parties and observations.',
                permittedActions: ['register', 'monitor', 'report', 'verify', 'attest'],
                issuedAt: timestamp(),
            },
            profile
        );
        await db.query("UPDATE dmrv.projects SET next_action='register',revision=revision+1,correction=NULL,updated_at=now() WHERE id=$1", [p.id]);
        await audit(db, p.id, profile, 'subject_authorised', { resource: reference(consent) });
        return consent;
    });
}
export async function audit(db: PoolClient, projectId: string, profile: string, event: string, detail: Doc = {}) {
    await db.query('INSERT INTO dmrv.audit_events(project_id,actor,event,detail) VALUES($1,$2,$3,$4)', [projectId, profile, event, detail]);
}
export async function projectSnapshot(id: string, profile: RoleId) {
    const project = await projectFor(id, profile);
    const [subject, resources, messages, deliveries, assets, exchanges, events, statuses] = await Promise.all([
        pool().query('SELECT * FROM dmrv.subjects WHERE project_id=$1', [id]),
        pool().query('SELECT * FROM dmrv.resources WHERE project_id=$1 ORDER BY created_at DESC', [id]),
        pool().query('SELECT * FROM dmrv.messages WHERE project_id=$1 ORDER BY received_at DESC', [id]),
        pool().query('SELECT d.* FROM dmrv.callback_deliveries d JOIN dmrv.messages m ON m.message_id=d.message_id WHERE m.project_id=$1', [id]),
        pool().query(
            'SELECT id,name,media_type,custodian,digest,size_bytes,descriptor,manifest_id FROM dmrv.assets WHERE project_id=$1 ORDER BY created_at DESC',
            [id]
        ),
        pool().query('SELECT * FROM dmrv.api_exchanges WHERE project_id=$1 ORDER BY created_at DESC LIMIT 150', [id]),
        pool().query('SELECT * FROM dmrv.audit_events WHERE project_id=$1 ORDER BY created_at DESC LIMIT 100', [id]),
        pool().query(
            'SELECT e.* FROM dmrv.resource_status_events e JOIN dmrv.resources r ON r.id=e.resource_id WHERE r.project_id=$1 ORDER BY e.created_at DESC',
            [id]
        ),
    ]);
    return {
        project,
        subject: subject.rows[0],
        current: Object.fromEntries(resources.rows.filter((r) => r.status === 'active').map((r) => [r.action, r])),
        resources: resources.rows,
        messages: messages.rows,
        deliveries: deliveries.rows,
        assets: assets.rows,
        exchanges: exchanges.rows,
        events: events.rows,
        statuses: statuses.rows,
        flow: journeySteps,
    };
}
