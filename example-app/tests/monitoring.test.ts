import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { observationRequest, defaultSamples, monitoringProfile } from '../lib/monitoring.ts';
import { monitoredEvidence, validateObservation, assessEvidence, evidenceStatement } from '../server/monitoring.ts';
import { party, parcels } from '../lib/model.ts';
import { monitoringDraftFor } from '../lib/journey-state.ts';
import { digest } from '../server/protocol.ts';
import { assetPath } from '../server/assets.ts';
import { inflateSync } from 'node:zlib';
import { syntheticCapture, captureWidth, captureHeight } from '../server/synthetic-capture.ts';

const subject = { id: 'urn:subject:test', geometry: parcels[0].geometry, crs: 'OGC:CRS84', area_ha: 20.67 };
for (const modalities of [{ manualStudy: true, satelliteCapture: false }, { manualStudy: false, satelliteCapture: true }, { manualStudy: true, satelliteCapture: true }]) {
    test('Selected evidence and semantics survive the pipeline: ' + JSON.stringify(modalities), () => {
        const id = 'test-' + randomUUID();
        const root = resolve('public/assets'), folder = resolve(root, id);
        try {
            const request = observationRequest(subject, party('measurement'), { modalities, samples: defaultSamples(), cloudCoverPercent: 17 });
            assert.equal(request.semanticProfile, monitoringProfile);
            assert.equal(!!request.agronomicContext, modalities.manualStudy);
            assert.equal(!!request.remoteSensingContext, modalities.satelliteCapture);
            assert.equal(!!request.manualStudy, modalities.manualStudy);
            if (modalities.satelliteCapture) { assert.equal(request.remoteSensingContext.requestedProductType, 'reseo:Sentinel2Product'); assert.equal(request.remoteSensingContext.product, undefined, 'A request describes intended output, not a captured product'); }
            const envelope = { context: { messageId: 'request-1' }, message: { observationRequest: request } };
            const output = monitoredEvidence({ id, activity_id: 'activity' }, subject, { id: 'registration' }, envelope, { id: 'manifest' });
            const content = Object.fromEntries(output.assets.map(a => [a.name, a.mediaType === 'image/png' ? readFileSync(assetPath(a.relativePath)) : readFileSync(assetPath(a.relativePath), 'utf8')]));
            assert.equal('soil-samples.csv' in content, modalities.manualStudy);
            assert.equal('practice-record.json' in content, modalities.manualStudy);
            assert.equal('satellite-image.png' in content, modalities.satelliteCapture);
            assert.equal('satellite-capture.json' in content, modalities.satelliteCapture);
            const assessment = assessEvidence(output.draft, content, subject.area_ha);
            const statement = evidenceStatement(assessment);
            assert.equal(statement.object.unit, modalities.manualStudy ? 'tCO2e' : '%');
            assert.equal(!!assessment.calculation, modalities.manualStudy);
            assert.equal(digest(assessment.semantics.environmentalContext), digest(request.environmentalContext));
            if (modalities.satelliteCapture) {
                assert.equal(assessment.semantics.remoteSensingContext.snapshot.type, 'reseo:Snapshot');
                assert.equal(assessment.semantics.remoteSensingContext.product.type, 'reseo:Sentinel2Product');
                const damaged = { ...content, 'satellite-image.png': Buffer.from('substituted image') };
                assert.throws(() => assessEvidence(output.draft, damaged, subject.area_ha), (e: any) => e.code === 'CAPTURE_MISMATCH');
            }
            if (!modalities.manualStudy) assert.throws(() => evidenceStatement(assessment, 99), (e: any) => e.code === 'UNSUPPORTED_QUANTITY');
            const restored = monitoringDraftFor({ messages: [{ direction: 'request', action: 'monitor', message_id: 'request-1', envelope }] }, id, null);
            assert.deepEqual(restored.modalities, modalities);
        } finally {
            assert.ok(folder.startsWith(root + sep));
            rmSync(folder, { recursive: true, force: true });
        }
    });
}

test('No modality is rejected; inactive inputs do not affect a selected study', () => {
    const none = observationRequest(subject, party('measurement'), { modalities: { manualStudy: false, satelliteCapture: false } });
    assert.throws(() => validateObservation(subject, none), (e: any) => e.code === 'MODALITY_REQUIRED');
    const manual = observationRequest(subject, party('measurement'), { modalities: { manualStudy: true, satelliteCapture: false }, cloudCoverPercent: 99 });
    assert.doesNotThrow(() => validateObservation(subject, manual));
    assert.deepEqual(manual, observationRequest(subject, party('measurement'), { modalities: { manualStudy: true, satelliteCapture: false }, cloudCoverPercent: 8 }));
});

test('Even a signed request must preserve its ontology profile and subject bindings', () => {
    const request = observationRequest(subject, party('measurement'), {});
    request.remoteSensingContext.requestedProductType = 'dmrv:InventedProduct';
    assert.throws(() => validateObservation(subject, request), (e: any) => e.code === 'ONTOLOGY_PROFILE_MISMATCH');
    const unknown = observationRequest(subject, party('measurement'), {});
    unknown.modalities.lidar = true;
    assert.throws(() => validateObservation(subject, unknown), (e: any) => e.code === 'UNSUPPORTED_MODALITY');
});

test('Synthetic PNG is a reproducible raster with the declared pixel cloud fraction', () => {
    const image = syntheticCapture(17);
    assert.equal(image.subarray(1, 4).toString(), 'PNG');
    const chunks: Buffer[] = [];
    for (let offset = 8; offset < image.length;) { const length = image.readUInt32BE(offset); if (image.subarray(offset + 4, offset + 8).toString() === 'IDAT') chunks.push(image.subarray(offset + 8, offset + 8 + length)); offset += length + 12; }
    const raw = inflateSync(Buffer.concat(chunks)); let clouds = 0;
    for (let y = 0; y < captureHeight; y++) for (let x = 0; x < captureWidth; x++) if (raw[y * (captureWidth * 3 + 1) + 1 + x * 3] === 228) clouds++;
    assert.equal(clouds / (captureWidth * captureHeight), .17);
    assert.deepEqual(image, syntheticCapture(17));
});
