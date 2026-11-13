import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correctionFailure, monitoringDraftFor, savedMonitoringDraft, stepState } from '../lib/journey-state.ts';

const samples = [
    { sample: 'S01', baselineSocPct: 1.41, currentSocPct: 1.73, bulkDensity: 1.25, depthCm: 25, rockFraction: 0.12 },
    { sample: 'S02', baselineSocPct: 1.5, currentSocPct: 1.81, bulkDensity: 1.2, depthCm: 25, rockFraction: 0.12 },
    { sample: 'S03', baselineSocPct: 1.6, currentSocPct: 1.92, bulkDensity: 1.15, depthCm: 25, rockFraction: 0.12 },
];
const monitor = (messageId: string, cloud = 0) => ({
    direction: 'request', action: 'monitor', message_id: messageId,
    envelope: { message: { observationRequest: { measurements: { samples, cloudCoverPercent: cloud } } } },
});

test('Monitoring revisions and reloads restore all submitted fields, including zero cloud cover', () => {
    const data = { messages: [monitor('latest'), monitor('older', 8)] };
    const draft = monitoringDraftFor(data, 'project', null);
    assert.deepEqual(draft.samples, samples);
    assert.equal(draft.cloudCoverPercent, 0);
    draft.samples[0].currentSocPct = 99;
    assert.equal(savedMonitoringDraft(data, 'project').samples[0].currentSocPct, 1.73, 'Editing cannot mutate saved observations');
});

test('Background polling preserves edits; a new submission or project restores its own values', () => {
    const data = { messages: [monitor('latest')] };
    const edited = { ...savedMonitoringDraft(data, 'project'), cloudCoverPercent: 16 };
    assert.equal(monitoringDraftFor(structuredClone(data), 'project', edited), edited);
    assert.equal(monitoringDraftFor({ messages: [monitor('new', 23)] }, 'project', edited).cloudCoverPercent, 23);
    assert.equal(monitoringDraftFor({ messages: [] }, 'different-project', edited).cloudCoverPercent, 8);
});

test('A failed monitoring submission retains the observations that need correction', () => {
    const failed = { ...monitor('failed', 64), business_outcome: 'failed' };
    assert.equal(savedMonitoringDraft({ messages: [failed, monitor('older', 8)] }, 'project').cloudCoverPercent, 64);
});

test('Failed verification is not completed even when its signed result remains current', () => {
    const request = { direction: 'request', action: 'verify', message_id: 'verify-1', business_outcome: 'failed', error: { code: 'CALCULATION_MISMATCH' } };
    const data = {
        project: { next_action: 'report', correction: { code: 'CALCULATION_MISMATCH' } },
        current: { verify: { document: { outcome: 'changes_requested' } } }, messages: [request],
    };
    assert.equal(stepState(data, 'verify'), 'failed');
    assert.equal(correctionFailure(data)?.action, 'verify');
    assert.equal(correctionFailure({ ...data, project: { correction: { code: 'REVISION_REQUESTED' } } }), undefined);
});

test('A pending retry or requested revision never inherits a previous completion checkmark', () => {
    const current = { verify: { document: { outcome: 'verified_with_qualifications' } } };
    assert.equal(stepState({ current, project: { next_action: 'verify' }, messages: [] }, 'verify'), 'unfinished');
    assert.equal(stepState({ current, project: { next_action: 'verify' }, messages: [{ direction: 'request', action: 'verify', message_id: 'retry' }] }, 'verify'), 'pending');
    assert.equal(stepState({ current, project: { next_action: 'attest' }, messages: [
        { direction: 'request', action: 'verify', message_id: 'retry', business_outcome: 'completed' },
        { direction: 'callback', correlation_id: 'retry', status: 'delivered', business_outcome: 'completed' },
    ] }, 'verify'), 'complete');
});
