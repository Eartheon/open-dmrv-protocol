import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalize, keypair, signObject, verifyObject, digest, hash } from '../server/crypto.ts';
import { calculate, makeEnvelope, validateEnvelopeShape, ack, clone } from '../server/protocol.ts';
import { assetPath } from '../server/assets.ts';
import { claimSemantics, claimContext, ontologyTerms } from '../lib/semantics.ts';
import { journeySteps, roleForStep } from '../lib/journey.ts';
import { areaHa, parcels } from '../lib/model.ts';

const csv =
    'sample,baselineSocPct,currentSocPct,bulkDensity,depthCm,rockFraction\nS01,1.10,1.20,1.3,30,0.05\nS02,1.15,1.25,1.3,30,0.05\nS03,1.12,1.22,1.3,30,0.05\n';
test('JCS handles key ordering, ECMAScript numbers and Unicode deterministically', () => {
    assert.equal(canonicalize({ z: -0, a: 'soil', b: 1e-7 }), '{"a":"soil","b":1e-7,"z":0}');
    assert.equal(digest({ b: 2, a: 1 }), digest({ a: 1, b: 2 }));
});
test('Invalid I-JSON values are rejected', () => {
    for (const v of [NaN, Infinity, undefined, '\ud800', new Date()]) assert.throws(() => canonicalize(v));
});
test('P-256 proofs detect protected-value changes', () => {
    const keys = keypair(),
        doc = signObject({ id: 'claim', value: 10 }, keys.privateKey, 'key-1');
    assert.equal(verifyObject(doc, keys.publicKey), true);
    doc.value = 100;
    assert.equal(verifyObject(doc, keys.publicKey), false);
});
test('Proof purpose, challenge and domain are also signed', () => {
    const keys = keypair(),
        original = signObject({ id: 'request' }, keys.privateKey, 'key-1', 'authentication', 'message-1');
    for (const field of ['proofPurpose', 'challenge', 'domain']) {
        const changed = clone(original);
        changed.proof[field] = 'forged';
        assert.equal(verifyObject(changed, keys.publicKey), false);
    }
});
test('A valid outer signature does not repair a tampered inner claim', () => {
    const reporter = keypair(),
        verifier = keypair();
    const claim = signObject({ id: 'claim', value: 10 }, reporter.privateKey, 'reporter');
    claim.value = 100;
    const request = signObject({ id: 'verify-request', message: { claim } }, verifier.privateKey, 'verifier');
    assert.equal(verifyObject(request, verifier.publicKey), true);
    assert.equal(verifyObject(request.message.claim, reporter.publicKey), false);
});
test('An honestly signed wrong quantity remains cryptographically valid', () => {
    const keys = keypair(),
        correct = calculate(csv, 1),
        doc = signObject({ value: correct.netTCO2e + 100 }, keys.privateKey, 'reporter');
    assert.equal(verifyObject(doc, keys.publicKey), true);
    assert.notEqual(doc.value, correct.netTCO2e);
});
test('Exact asset bytes have different hashes after tampering', () => {
    assert.notEqual(hash(csv).toString('hex'), hash(csv.replace('1.20', '9.20')).toString('hex'));
});
test('Illustrative stock calculation has reproducible units and deductions', () => {
    const r = calculate(csv, 1);
    assert.equal(r.deltaTCPerHa, 3.705);
    assert.equal(r.netTCO2e, 10.548);
    assert.equal(r.samples, 3);
});
test('Missing and malformed observations fail with a monitoring correction', () => {
    assert.throws(
        () => calculate('incorrect header\n', 1),
        (e: any) => e.retryFrom === 'monitor'
    );
    assert.throws(
        () => calculate(csv.replace('1.3', '-1'), 1),
        (e: any) => e.code === 'INVALID_EVIDENCE'
    );
    assert.throws(() => calculate(csv.split('\n').slice(0, 3).join('\n'), 1));
});
test('Map polygons use real geographic coordinates and derived hectares', () => {
    for (const p of parcels) {
        assert.ok(areaHa(p.geometry) > 10);
        assert.ok(areaHa(p.geometry) < 50);
        assert.ok(p.geometry.coordinates[0].every(([lon, lat]) => lon > 79 && lon < 80 && lat > 10 && lat < 11));
    }
});
test('Claim structure uses exact AgrO, ENVO and RESEO types and relationships', () => {
    const claim = claimSemantics('urn:subject:1', 'urn:asset:1');
    assert.equal(claim.agronomicContext!.equipment.type, 'agro:00000416');
    assert.equal(claim.environmentalContext.material.type, 'envo:00001998');
    assert.equal(claim.remoteSensingContext!.product.type, 'reseo:Sentinel2Product');
    assert.deepEqual(claim.remoteSensingContext!.product.hasDataSource.type, ['reseo:DataSource', 'reseo:Sentinel2']);
    assert.equal(claimContext.hasDataSource['@id'], 'reseo:hasDataSource');
    assert.deepEqual([...new Set(ontologyTerms.map((t) => t.ontology))], ['AgrO', 'ENVO', 'RESEO']);
});
test('Request context binds the actual verb, role, project and callback URL', () => {
    const project = { id: '00000000-0000-4000-8000-000000000001', revision: 3, transaction_id: 'urn:uuid:00000000-0000-4000-8000-000000000002' };
    const envelope = makeEnvelope('monitor', 'measurement', project, { activityId: 'urn:activity' });
    assert.doesNotThrow(() => validateEnvelopeShape(envelope, 'monitor', 'measurement'));
    assert.ok(envelope.context.callbackUri.endsWith('/on_monitor'));
    assert.equal(envelope.context.projectRevision, 3);
    const altered = clone(envelope);
    altered.context.callbackUri = 'https://unregistered.example/callback';
    assert.throws(
        () => validateEnvelopeShape(altered, 'monitor', 'measurement'),
        (e: any) => e.code === 'INVALID_ENVELOPE'
    );
    assert.throws(() => validateEnvelopeShape(envelope, 'monitor', 'reporter'));
});
test('One guided step maps to one accountable profile', () => {
    assert.equal(journeySteps.length, 6);
    assert.equal(roleForStep('consent'), 'controller');
    assert.equal(roleForStep('register'), 'implementer');
    assert.equal(roleForStep('verify'), 'verifier');
    assert.equal(roleForStep('attest'), 'attester');
});
test('Asset resolver rejects path traversal outside public asset storage', () => {
    assert.throws(() => assetPath('../.env.local'));
    assert.throws(() => assetPath('assets/../../runtime/keys.private.json'));
    assert.ok(assetPath('assets/project/file.csv').endsWith('file.csv'));
});
test('ACK and NACK are explicit transport responses', () => {
    assert.deepEqual(ack(), { ack: { status: 'ACK' }, error: null });
    assert.equal(ack('NACK', { code: 'INVALID_SIGNATURE' }).error?.code, 'INVALID_SIGNATURE');
});
