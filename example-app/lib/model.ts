export const roles = [
    {
        id: 'controller',
        role: 'SubjectController',
        name: 'Fieldkeeper',
        org: 'Kaveri Growers Cooperative',
        person: 'Meena Ravi',
        title: 'Land steward',
        verb: 'Authorise participation',
        color: '#35705a',
        port: 3101,
        icon: 'field',
        description: 'Choose a field, review consent, and follow what is claimed about your land.',
    },
    {
        id: 'implementer',
        role: 'Implementer',
        name: 'Project Studio',
        org: 'Eartheon Projects · Demo',
        person: 'Arjun Shah',
        title: 'Project implementer',
        verb: 'Register the activity',
        color: '#9a6239',
        port: 3102,
        icon: 'layers',
        description: 'Connect the subject, methodology, accountable parties, and registered agents.',
    },
    {
        id: 'measurement',
        role: 'MeasurementProvider',
        name: 'Observatory',
        org: 'TerraSense Laboratory · Demo',
        person: 'Priya Nair',
        title: 'Measurement provider',
        verb: 'Publish evidence',
        color: '#3b7187',
        port: 3103,
        icon: 'scan',
        description: 'Package laboratory samples, practice records, and satellite observations.',
    },
    {
        id: 'reporter',
        role: 'ReportingProvider',
        name: 'Carbon Ledger',
        org: 'Carbon Analytics · Demo',
        person: 'Dev Menon',
        title: 'Reporting provider',
        verb: 'Issue a claim',
        color: '#6c659b',
        port: 3104,
        icon: 'report',
        description: 'Reproduce the estimate and sign an assertion bound to its evidence.',
    },
    {
        id: 'verifier',
        role: 'AssuranceProvider',
        name: 'Assurance Desk',
        org: 'Independent Assurance · Demo',
        person: 'Sara Thomas',
        title: 'Independent verifier',
        verb: 'Verify the claim',
        color: '#345b8a',
        port: 3105,
        icon: 'shield',
        description: 'Retrieve evidence, test integrity and calculations, and record independent findings.',
    },
    {
        id: 'standards',
        role: 'StandardsAuthority',
        name: 'Standards Library',
        org: 'Gold Standard · Reference view',
        person: 'Reference librarian',
        title: 'Standards authority',
        verb: 'Explore the methodology',
        color: '#a47f31',
        port: 3106,
        icon: 'book',
        description: 'Inspect pinned Gold Standard documents, scope, and version requirements.',
    },
    {
        id: 'attester',
        role: 'AttestingAuthority',
        name: 'Attestation Office',
        org: 'Demo Programme Authority',
        person: 'Leela Iyer',
        title: 'Attesting authority',
        verb: 'Endorse the result',
        color: '#805b74',
        port: 3107,
        icon: 'seal',
        description: 'Bind an accepted verification and its claim in a separate signed endorsement.',
    },
    {
        id: 'registrar',
        role: 'Registrar',
        name: 'Trust Registry',
        org: 'Open dMRV Sandbox Registrar',
        person: 'Registry operator',
        title: 'Network registrar',
        verb: 'Inspect trust identities',
        color: '#566468',
        port: 3108,
        icon: 'key',
        description: 'Resolve accountable parties, public keys, roles, expiry, and revocation.',
    },
] as const;
export type RoleId = (typeof roles)[number]['id'];
export const party = (role: string) => `https://sandbox.open-dmrv.local/parties/${role}`;
export const agent = (role: string) => `https://sandbox.open-dmrv.local/agents/${role}`;
export const steps = ['register', 'monitor', 'report', 'verify', 'attest'] as const;
export type Action = (typeof steps)[number];
export type Doc = Record<string, any>;
export const actionRole: Record<Action, RoleId> = {
    register: 'implementer',
    monitor: 'measurement',
    report: 'reporter',
    verify: 'verifier',
    attest: 'attester',
};
export const outputKey: Record<Action, string> = {
    register: 'registrationResults',
    monitor: 'evidenceManifest',
    report: 'claim',
    verify: 'verificationResult',
    attest: 'attestation',
};
export const parcels = [
    {
        id: 'field-042',
        name: 'Kaveri North',
        village: 'Thanjavur, Tamil Nadu',
        crop: 'Paddy / cover crop rotation',
        geometry: {
            type: 'Polygon',
            coordinates: [
                [
                    [79.08, 10.77],
                    [79.085, 10.7706],
                    [79.0841, 10.7741],
                    [79.0796, 10.7735],
                    [79.08, 10.77],
                ],
            ],
        },
    },
    {
        id: 'field-043',
        name: 'Canal East',
        village: 'Thanjavur, Tamil Nadu',
        crop: 'Paddy / pulse rotation',
        geometry: {
            type: 'Polygon',
            coordinates: [
                [
                    [79.086, 10.7708],
                    [79.0902, 10.7711],
                    [79.0899, 10.7744],
                    [79.0852, 10.7742],
                    [79.086, 10.7708],
                ],
            ],
        },
    },
    {
        id: 'field-044',
        name: 'Mango Bend',
        village: 'Thanjavur, Tamil Nadu',
        crop: 'Mixed agricultural land',
        geometry: {
            type: 'Polygon',
            coordinates: [
                [
                    [79.08, 10.775],
                    [79.084, 10.7756],
                    [79.0834, 10.7783],
                    [79.0797, 10.7778],
                    [79.08, 10.775],
                ],
            ],
        },
    },
];
export function areaHa(geometry: Doc): number {
    const ring = geometry.coordinates[0] as number[][];
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) {
        const [lon1, lat1] = ring[i],
            [lon2, lat2] = ring[i + 1];
        sum += (((lon2 - lon1) * Math.PI) / 180) * (2 + Math.sin((lat1 * Math.PI) / 180) + Math.sin((lat2 * Math.PI) / 180));
    }
    return Math.round(((Math.abs(sum) * 6371008.8 ** 2) / 2 / 10000) * 100) / 100;
}
export const methodology = {
    id: 'https://globalgoals.goldstandard.org/402-luf-agr-fm-soil-organic-carbon-framework-methodolgy/',
    name: 'Soil Organic Carbon Framework Methodology',
    authority: 'Gold Standard',
    version: '1.0',
    published: '2020-01',
    document: 'https://globalgoals.goldstandard.org/standards/402_V1.0_LUF_AGR_FM_Soil-Organic-Carbon-Framework-Methodolgy.pdf',
    guidelines: 'https://globalgoals.goldstandard.org/standards/402.7_V1.0_Soil-Organic-Carbon-Model-requirements-and-Guidelines.pdf',
    alignment: 'https://globalgoals.goldstandard.org/gs4gg-paris-agreement-alignment/',
    equation: 'ER = (ΔSOC × 44/12 − project emissions − leakage) × (1 − buffer)',
    referenceOnly: true,
    certificationEligible: false,
    limitation:
        'Pinned educational reference. An applicable activity module, current Paris-aligned methodology, eligibility, additionality, sampling design and programme review are required before any certification claim.',
};
export const ontology = [
    {
        prefix: 'AGRO',
        label: 'Agricultural implement',
        iri: 'http://purl.obolibrary.org/obo/AGRO_00000416',
        use: 'Registered no-till drill used for the agricultural practice',
        version: '2022-11-02',
        source: 'https://github.com/AgriculturalSemantics/agro',
        license: 'CC BY 4.0',
    },
    {
        prefix: 'ENVO',
        label: 'Soil',
        iri: 'http://purl.obolibrary.org/obo/ENVO_00001998',
        use: 'Environmental material sampled by the laboratory',
        version: 'term reference',
        source: 'https://github.com/EnvironmentOntology/envo',
        license: 'CC BY 4.0',
    },
    {
        prefix: 'RESEO',
        label: 'Sentinel 2 product',
        iri: 'https://w3id.org/reseo#Sentinel2Product',
        use: 'Supporting Earth-observation product and its data source',
        version: '1.0',
        source: 'https://github.com/KhaosResearch/REmoteSEnsingOntology',
        license: 'MIT',
    },
];
export const contexts = {
    '@vocab': 'https://sandbox.open-dmrv.local/vocab/',
    id: '@id',
    type: '@type',
    dmrv: 'https://sandbox.open-dmrv.local/vocab/',
    agro: { '@id': 'http://purl.obolibrary.org/obo/AGRO_', '@prefix': true },
    envo: { '@id': 'http://purl.obolibrary.org/obo/ENVO_', '@prefix': true },
    reseo: 'https://w3id.org/reseo#',
    schema: 'https://schema.org/',
    agriculturalImplement: { '@id': 'dmrv:agriculturalImplement', '@type': '@id' },
    environmentalMaterial: { '@id': 'dmrv:environmentalMaterial', '@type': '@id' },
    remoteSensingProduct: { '@id': 'dmrv:remoteSensingProduct', '@type': '@id' },
    hasDataSource: { '@id': 'reseo:hasDataSource', '@type': '@id' },
    hasNetCarbonRemoval: 'dmrv:hasNetCarbonRemoval',
};
export const scenarios = [
    {
        id: 'claim-tamper',
        code: 'INVALID_SIGNATURE',
        label: 'Alter the reported quantity',
        detail: 'Replace claim.json in runtime/inbox. The original proof no longer verifies.',
        repeat: 'report',
    },
    {
        id: 'asset-tamper',
        code: 'DIGEST_MISMATCH',
        label: 'Edit a laboratory result',
        detail: 'Replace soil-samples.csv in runtime/inbox. The evidence hash no longer matches.',
        repeat: 'monitor',
    },
    {
        id: 'missing-evidence',
        code: 'EVIDENCE_UNAVAILABLE',
        label: 'Evidence custodian unavailable',
        detail: 'The verifier cannot retrieve the required soil samples.',
        repeat: 'monitor',
    },
    {
        id: 'revoked-key',
        code: 'REVOKED_KEY',
        label: 'Compromised measurement key',
        detail: 'The registry revokes the key with effect before evidence signing.',
        repeat: 'register',
    },
    {
        id: 'expired-key',
        code: 'EXPIRED_KEY',
        label: 'Expired reporting key',
        detail: 'Key validity no longer includes the signing instant.',
        repeat: 'register',
    },
    {
        id: 'independence',
        code: 'INDEPENDENCE_REQUIREMENT_FAILED',
        label: 'A reporter verifies its own claim',
        detail: 'The assurance party is set to the reporting party. Separation of duties fails.',
        repeat: 'register',
    },
    {
        id: 'calculation',
        code: 'CALCULATION_MISMATCH',
        label: 'Valid signature, wrong calculation',
        detail: 'Issue an honestly signed but inflated claim. Integrity passes; reproduction fails.',
        repeat: 'report',
    },
    {
        id: 'clouds',
        code: 'QUALITY_INSUFFICIENT',
        label: 'Cloud-obscured satellite evidence',
        detail: 'A signed manifest records 64% cloud cover against a 20% demo profile limit.',
        repeat: 'monitor',
    },
    {
        id: 'access-denied',
        code: 'ACCESS_DENIED',
        label: 'Evidence access denied',
        detail: 'The custodian denies the requesting verifier under the demo access policy.',
        repeat: 'register',
    },
    {
        id: 'expired-grant',
        code: 'ACCESS_GRANT_EXPIRED',
        label: 'Expired evidence grant',
        detail: 'A real signed short-lived grant expires before retrieval.',
        repeat: 'verify',
    },
    {
        id: 'callback',
        code: 'CALLBACK_DELIVERY_FAILED',
        label: 'Callback delivery interrupted',
        detail: 'The signed business result survives. Retry delivers the identical callback.',
        repeat: 'callback',
    },
    {
        id: 'replay',
        code: 'CONFLICTING_MESSAGE',
        label: 'Reuse a message ID with new bytes',
        detail: 'Identical bytes return the stored ACK. Changed bytes return HTTP 409.',
        repeat: 'request',
    },
] as const;
