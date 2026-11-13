import { stageIndex } from './journey.ts';
import type { Doc } from './model.ts';

export type SoilSample = {
    sample: string;
    baselineSocPct: number;
    currentSocPct: number;
    bulkDensity: number;
    depthCm: number;
    rockFraction: number;
};
export type MonitoringDraft = { sourceId: string; samples: SoilSample[]; cloudCoverPercent: number };

// Messages arrive newest first. Restore the last submission, including observations
// that failed validation, so a correction starts with what the user submitted.
export function savedMonitoringDraft(data: Doc | null, projectId: string): MonitoringDraft {
    const request = data?.messages.find((m: Doc) => m.direction === 'request' && m.action === 'monitor');
    const measurements = request?.envelope.message.observationRequest?.measurements;
    if (measurements) {
        return {
            sourceId: projectId + ':' + request.message_id,
            samples: measurements.samples.map((sample: SoilSample) => ({ ...sample })),
            cloudCoverPercent: measurements.cloudCoverPercent,
        };
    }
    return {
        sourceId: projectId + ':initial',
        samples: [
            { sample: 'S01', baselineSocPct: 1.1, currentSocPct: 1.2, bulkDensity: 1.3, depthCm: 30, rockFraction: 0.05 },
            { sample: 'S02', baselineSocPct: 1.15, currentSocPct: 1.25, bulkDensity: 1.3, depthCm: 30, rockFraction: 0.05 },
            { sample: 'S03', baselineSocPct: 1.12, currentSocPct: 1.22, bulkDensity: 1.3, depthCm: 30, rockFraction: 0.05 },
        ],
        cloudCoverPercent: 8,
    };
}

export function monitoringDraftFor(data: Doc | null, projectId: string, edited: MonitoringDraft | null): MonitoringDraft {
    const saved = savedMonitoringDraft(data, projectId);
    // Polling returns a new snapshot object every time; only a new submission or
    // project should replace a draft. Never overwrite edits with a polling result.
    return edited?.sourceId === saved.sourceId ? edited : saved;
}

export function latestStepRequest(data: Doc, step: string): Doc | undefined {
    return data.messages.find((m: Doc) => m.direction === 'request' && m.action === step);
}

export function stepState(data: Doc, step: string): 'failed' | 'pending' | 'complete' | 'unfinished' {
    const request = latestStepRequest(data, step);
    if (request?.business_outcome === 'failed') return 'failed';
    if (request) {
        const callback = data.messages.find((m: Doc) => m.direction === 'callback' && m.correlation_id === request.message_id);
        if (callback?.business_outcome === 'failed') return 'failed';
        if (callback?.status !== 'delivered') return 'pending';
    }
    const resource = data.current[step];
    if (!resource) return 'unfinished';
    if (step === 'verify' && !['verified', 'verified_with_qualifications'].includes(resource.document.outcome)) return 'failed';
    // An existing result does not complete a newly requested correction, nor any
    // downstream step whose assurance must be renewed.
    if (data.project.next_action !== 'complete' && stageIndex(step) >= stageIndex(data.project.next_action)) return 'unfinished';
    return 'complete';
}

export function correctionFailure(data: Doc): Doc | undefined {
    const correction = data.project.correction;
    if (!correction || ['REVISION_REQUESTED', 'LEGACY_HISTORY_IMPORTED'].includes(correction.code)) return;
    return data.messages.find((m: Doc) => m.direction === 'request' && m.business_outcome === 'failed' && m.error?.code === correction.code);
}
