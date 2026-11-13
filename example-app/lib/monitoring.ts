import { claimContext, claimSemantics } from './semantics.ts';
import type { Doc } from './model.ts';

export type Modalities = { manualStudy: boolean; satelliteCapture: boolean };
export const monitoringProfile = 'urn:open-dmrv:demo:monitoring:v1';
export const satelliteProfile = 'urn:open-dmrv:demo:satellite-observation:v1';
export function modalitiesOf(document: Doc): Modalities {
    // Older signed requests/manifests always contained both modalities.
    return document.modalities ?? { manualStudy: true, satelliteCapture: true };
}
export function defaultSamples() {
    return [
        { sample: 'S01', baselineSocPct: 1.1, currentSocPct: 1.2, bulkDensity: 1.3, depthCm: 30, rockFraction: .05 },
        { sample: 'S02', baselineSocPct: 1.15, currentSocPct: 1.25, bulkDensity: 1.3, depthCm: 30, rockFraction: .05 },
        { sample: 'S03', baselineSocPct: 1.12, currentSocPct: 1.22, bulkDensity: 1.3, depthCm: 30, rockFraction: .05 },
    ];
}
export function observationRequest(subject: Doc, provider: string, values: Doc): Doc {
    const modalities = values.modalities ?? { manualStudy: true, satelliteCapture: true };
    const depths = modalities.manualStudy && Array.isArray(values.samples) ? [...new Set(values.samples.map((s: Doc) => s?.depthCm))] as number[] : [30];
    const semantics = claimSemantics(subject.id, '', modalities, depths);
    const requestPaths: Record<string, string> = { 'reseo:Sentinel2Product': '/remoteSensingContext/requestedProductType', 'reseo:Sentinel2': '/remoteSensingContext/requestedDataSourceType', 'reseo:RasterImage': '/remoteSensingContext/requestedImageType' };
    return {
        '@context': claimContext, type: 'dmrv:ObservationRequest', semanticProfile: monitoringProfile, modalities,
        subjectId: subject.id, spatial: { geometry: subject.geometry, crs: subject.crs },
        temporal: { start: '2024-01-01T00:00:00Z', end: '2025-12-31T23:59:59Z' },
        measurementProvider: provider, phenomena: [...(modalities.manualStudy ? ['dmrv:SoilOrganicCarbonMassFraction'] : []), ...(modalities.satelliteCapture ? ['dmrv:SceneCloudCoverage'] : [])],
        environmentalContext: semantics.environmentalContext,
        ...(modalities.manualStudy ? {
            agronomicContext: semantics.agronomicContext,
            manualStudy: { type: 'dmrv:ManualFieldStudyRequest', studyDesign: 'Synthetic paired soil samples', samples: values.samples ?? defaultSamples() },
        } : {}),
        ...(modalities.satelliteCapture ? {
            remoteSensingContext: {
                type: 'dmrv:SatelliteCaptureRequest', requestedProductType: 'reseo:Sentinel2Product',
                requestedDataSourceType: 'reseo:Sentinel2', requestedImageType: 'reseo:RasterImage',
                processingLevel: 'L2A', acquisitionTime: '2025-12-15T05:10:00Z',
                simulatedCloudCoverPercent: values.cloudCoverPercent ?? 8, synthetic: true,
            },
        } : {}),
        ontologyReferences: semantics.ontologyReferences.filter(t => t.ontology !== 'RESEO' || requestPaths[t.prefix]).map(t => ({ ...t, path: requestPaths[t.prefix] ?? t.path })),
    };
}

export function observationInputs(observation: Doc) {
    return {
        modalities: modalitiesOf(observation),
        samples: observation.manualStudy?.samples ?? observation.measurements?.samples ?? defaultSamples(),
        cloudCoverPercent: observation.remoteSensingContext?.simulatedCloudCoverPercent ?? observation.measurements?.cloudCoverPercent ?? 8,
    };
}
