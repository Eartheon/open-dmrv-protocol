import { observationInputs, observationRequest, modalitiesOf, monitoringProfile, satelliteProfile } from '../lib/monitoring.ts';
import { claimSemantics, semanticFields } from '../lib/semantics.ts';
import { prepareAsset } from './assets.ts';
import { calculate, digest, fail, uid, reference } from './protocol.ts';
import { syntheticCapture, captureWidth, captureHeight } from './synthetic-capture.ts';
import type { Doc } from '../lib/model.ts';
import { party, agent } from '../lib/model.ts';

export function sampleCsv(samples: Doc[]) {
    if (!Array.isArray(samples) || samples.length > 100) fail('INVALID_OBSERVATIONS', 'Supply up to 100 paired field samples.', 422, 'monitor');
    return 'sample,baselineSocPct,currentSocPct,bulkDensity,depthCm,rockFraction\n' + samples.map((s, i) =>
        ['S' + String(i + 1).padStart(2, '0'), s?.baselineSocPct, s?.currentSocPct, s?.bulkDensity, s?.depthCm, s?.rockFraction].join(',')).join('\n') + '\n';
}

export function validateObservation(subject: Doc, observation: Doc) {
    if (!observation || typeof observation !== 'object') fail('INVALID_OBSERVATIONS', 'An observation request is required.', 422, 'monitor');
    const inputs = observationInputs(observation), m = inputs.modalities;
    if (m && Object.keys(m).some(key => !['manualStudy', 'satelliteCapture'].includes(key)))
        fail('UNSUPPORTED_MODALITY', 'This profile supports manual field study and satellite image capture only.', 422, 'monitor');
    if (!m || typeof m.manualStudy !== 'boolean' || typeof m.satelliteCapture !== 'boolean' || (!m.manualStudy && !m.satelliteCapture))
        fail('MODALITY_REQUIRED', 'Choose manual field study, satellite capture, or both.', 422, 'monitor');
    if (m.manualStudy) calculate(sampleCsv(inputs.samples), Number(subject.area_ha));
    if (m.satelliteCapture && (!Number.isFinite(inputs.cloudCoverPercent) || inputs.cloudCoverPercent < 0 || inputs.cloudCoverPercent > 100))
        fail('INVALID_OBSERVATIONS', 'Satellite cloud cover must be between 0 and 100%.', 422, 'monitor');
    if (observation.semanticProfile) {
        const expected = observationRequest(subject, party('measurement'), inputs);
        if (digest(observation) !== digest(expected)) fail('ONTOLOGY_PROFILE_MISMATCH',
            'The observation request does not match its selected modalities, ontology terms, subject or demonstration profile.', 422, 'monitor');
    }
    return inputs;
}

export function monitoredEvidence(project: Doc, subject: Doc, registration: Doc, envelope: Doc, base: Doc) {
    const observation = envelope.message.observationRequest;
    const inputs = validateObservation(subject, observation), m = inputs.modalities;
    const assets: ReturnType<typeof prepareAsset>[] = [];
    const jsonAsset = (name: string, value: Doc) => { const a = prepareAsset(project.id, name, 'application/json', JSON.stringify(value, null, 2)); assets.push(a); return a; };
    const productId = uid();
    const semantics: Doc = claimSemantics(subject.id, productId, m, m.manualStudy ? [...new Set(inputs.samples.map((s: Doc) => s.depthCm))] as number[] : []);
    let study: Doc | undefined, satellite: Doc | undefined;
    if (m.manualStudy) {
        const csv = prepareAsset(project.id, 'soil-samples.csv', 'text/csv', sampleCsv(inputs.samples)); assets.push(csv);
        const practice = jsonAsset('practice-record.json', { '@context': semantics['@context'], type: 'dmrv:PracticeRecord', activityId: project.activity_id,
            agronomicContext: semantics.agronomicContext, ...(registration.authorisation ? { authorisation: registration.authorisation } : {}), synthetic: true });
        study = { type: 'dmrv:ManualFieldStudy', sampleSize: inputs.samples.length, studyDesign: 'Synthetic paired field samples; equal weights',
            measurements: csv.descriptor, practiceRecord: practice.descriptor };
    }
    assets.push(prepareAsset(project.id, 'field-boundary.geojson', 'application/geo+json', JSON.stringify({ type: 'Feature', geometry: subject.geometry,
        properties: { id: subject.id, name: subject.name, demonstrationBoundary: true } }, null, 2)));
    if (m.satelliteCapture) {
        const image = prepareAsset(project.id, 'satellite-image.png', 'image/png', syntheticCapture(inputs.cloudCoverPercent)); assets.push(image);
        const remote = semantics.remoteSensingContext!;
        remote.product.image = { id: image.id, type: 'reseo:RasterImage', asset: image.descriptor };
        remote.snapshot = { id: productId + ':snapshot', type: 'reseo:Snapshot', cloudCoverPercent: inputs.cloudCoverPercent,
            hasProduct: { id: productId, type: 'reseo:Sentinel2Product' } };
        satellite = { '@context': semantics['@context'], id: productId, type: 'reseo:Sentinel2Product',
            hasDataSource: remote.product.hasDataSource, snapshot: remote.snapshot, image: image.descriptor,
            spatial: { geometry: subject.geometry, crs: subject.crs }, acquiredAt: '2025-12-15T05:10:00Z',
            processingLevel: 'L2A', width: captureWidth, height: captureHeight, synthetic: true,
            limitation: 'Deterministic synthetic image fixture. No satellite was tasked; no physical reflectance or soil carbon is inferred.' };
        jsonAsset('satellite-capture.json', satellite);
    }
    return { draft: { ...base, ...semantics, type: 'EvidenceManifest', semanticProfile: monitoringProfile, modalities: m,
        provider: observation.measurementProvider, agent: agent('measurement'), subjectId: subject.id,
        spatial: { geometry: subject.geometry, crs: subject.crs, areaHa: Number(subject.area_ha) }, temporal: observation.temporal,
        sourceRequest: { messageId: envelope.context.messageId, digest: digest(envelope) },
        assets: assets.map(a => a.descriptor), ...(study ? { manualStudy: study } : {}),
        ...(satellite ? { satelliteQuality: { cloudCoverPercent: inputs.cloudCoverPercent, maxCloudCoverPercent: 20 } } : {}),
        registration: reference(registration) }, assets };
}

function parseAsset(content: Record<string, string | Buffer>, name: string): Doc {
    if (!(name in content)) fail('EVIDENCE_UNAVAILABLE', 'The selected modality requires ' + name + '.', 422, 'monitor');
    try { return JSON.parse(content[name].toString()); } catch { return fail('INVALID_EVIDENCE', name + ' is not valid JSON.', 422, 'monitor'); }
}

export function assessEvidence(manifest: Doc, content: Record<string, string | Buffer>, area: number) {
    const m = modalitiesOf(manifest);
    if (typeof m.manualStudy !== 'boolean' || typeof m.satelliteCapture !== 'boolean' || (!m.manualStudy && !m.satelliteCapture))
        fail('MODALITY_REQUIRED', 'The evidence must declare at least one observation modality.', 422, 'monitor');
    if ((!m.manualStudy && 'soil-samples.csv' in content) || (!m.satelliteCapture && ('satellite-image.png' in content || 'satellite-capture.json' in content)))
        fail('UNEXPECTED_EVIDENCE', 'Evidence includes a modality that was not selected.', 422, 'monitor');
    let calculation: Doc | null = null, capture: Doc | null = null;
    if (m.manualStudy) {
        if (!content['soil-samples.csv']) fail('EVIDENCE_UNAVAILABLE', 'Manual study requires its original soil sample CSV.', 422, 'monitor');
        calculation = calculate(content['soil-samples.csv'].toString(), area);
    }
    if (m.satelliteCapture) {
        if (manifest.semanticProfile) {
            capture = parseAsset(content, 'satellite-capture.json');
            const cloud = capture.snapshot?.cloudCoverPercent;
            const image = manifest.assets.find((a: Doc) => a.name === 'satellite-image.png');
            if (!image || !Buffer.isBuffer(content['satellite-image.png']) || capture.image?.id !== image.id || digest(capture.image) !== digest(image)
                || capture.type !== 'reseo:Sentinel2Product' || capture.snapshot?.type !== 'reseo:Snapshot'
                || capture.width !== captureWidth || capture.height !== captureHeight || capture.synthetic !== true
                || !Number.isFinite(cloud) || cloud < 0 || cloud > 100 || cloud !== manifest.satelliteQuality?.cloudCoverPercent
                || !content['satellite-image.png'].equals(syntheticCapture(cloud)))
                fail('CAPTURE_MISMATCH', 'The image, synthetic capture metadata and signed manifest do not describe the same capture.', 422, 'monitor');
            if (digest(manifest.remoteSensingContext?.snapshot ?? null) !== digest(capture.snapshot)
                || manifest.remoteSensingContext?.product?.id !== capture.id
                || digest(manifest.remoteSensingContext?.product?.image?.asset ?? null) !== digest(image)
                || digest(capture.spatial ?? null) !== digest({ geometry: manifest.spatial.geometry, crs: manifest.spatial.crs }))
                fail('ONTOLOGY_PROFILE_MISMATCH', 'The captured product, scene and ontology relationships disagree.', 422, 'monitor');
        } else {
            // Historical manifests contain supporting metadata, not an image fixture.
            capture = { snapshot: { cloudCoverPercent: manifest.satelliteQuality.cloudCoverPercent }, synthetic: true };
        }
    }
    if (manifest.semanticProfile) {
        const depths = m.manualStudy ? [...new Set(content['soil-samples.csv'].toString().trim().split(/\r?\n/).slice(1).map(row => Number(row.split(',')[4])))] : [];
        const expected: Doc = claimSemantics(manifest.subjectId, capture?.id || '', m, depths);
        if (m.satelliteCapture) {
            const image = manifest.assets.find((a: Doc) => a.name === 'satellite-image.png');
            expected.remoteSensingContext.product.image = { id: image.id, type: 'reseo:RasterImage', asset: image };
            expected.remoteSensingContext.snapshot = { id: capture!.id + ':snapshot', type: 'reseo:Snapshot', cloudCoverPercent: capture!.snapshot.cloudCoverPercent,
                hasProduct: { id: capture!.id, type: 'reseo:Sentinel2Product' } };
            if (digest(capture!.hasDataSource ?? null) !== digest(expected.remoteSensingContext.product.hasDataSource))
                fail('ONTOLOGY_PROFILE_MISMATCH', 'The captured product does not identify its expected synthetic source.', 422, 'monitor');
        }
        if (manifest.semanticProfile !== monitoringProfile || digest(semanticFields(manifest)) !== digest(expected))
            fail('ONTOLOGY_PROFILE_MISMATCH', 'The evidence ontology terms and relationships do not match its declared monitoring profile.', 422, 'monitor');
        if (m.manualStudy) {
            const practice = parseAsset(content, 'practice-record.json');
            const csv = manifest.assets.find((a: Doc) => a.name === 'soil-samples.csv');
            if (digest(practice.agronomicContext ?? null) !== digest(expected.agronomicContext) || manifest.manualStudy?.sampleSize !== calculation!.samples
                || digest(manifest.manualStudy?.measurements ?? null) !== digest(csv))
                fail('ONTOLOGY_PROFILE_MISMATCH', 'The field study, practice equipment and soil sample references disagree.', 422, 'monitor');
        }
    }
    return { modalities: m, calculation, capture,
        semantics: manifest.semanticProfile ? semanticFields(manifest) : claimSemantics(manifest.subjectId, manifest.assets.find((a: Doc) => a.name === 'satellite-context.json')?.id || '', m) };
}

export function evidenceStatement(assessment: ReturnType<typeof assessEvidence>, requestedQuantity: number | null = null) {
    if (assessment.calculation) {
        const value = requestedQuantity ?? assessment.calculation.netTCO2e;
        if (!Number.isFinite(value) || value < 0) fail('INVALID_QUANTITY', 'The claimed quantity must be a non-negative number.', 422, 'report');
        return { predicate: 'dmrv:hasNetCarbonRemoval', object: { value, unit: 'tCO2e', calculation: assessment.calculation } };
    }
    if (requestedQuantity !== null) fail('UNSUPPORTED_QUANTITY', 'Satellite imagery alone does not supply soil-carbon measurements. Create an observation claim or add a manual study.', 422, 'report');
    const cloud = assessment.capture!.snapshot.cloudCoverPercent;
    return { predicate: 'dmrv:hasClearSceneCoverage', object: { value: +(100 - cloud).toFixed(4), unit: '%', cloudCoverPercent: cloud,
        synthetic: true, profile: satelliteProfile } };
}
