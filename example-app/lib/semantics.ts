export const claimContext = {
    '@version': 1.1,
    '@vocab': 'https://open-dmrv.example/vocab/',
    id: '@id',
    type: '@type',
    dmrv: 'https://open-dmrv.example/vocab/',
    agro: { '@id': 'http://purl.obolibrary.org/obo/AGRO_', '@prefix': true },
    envo: { '@id': 'http://purl.obolibrary.org/obo/ENVO_', '@prefix': true },
    reseo: 'https://w3id.org/reseo#',
    issuer: { '@id': 'dmrv:issuer', '@type': '@id' },
    hasDataSource: { '@id': 'reseo:hasDataSource' },
};
export const ontologyTerms = [
    {
        ontology: 'AgrO',
        term: 'Agricultural implement',
        iri: 'http://purl.obolibrary.org/obo/AGRO_00000416',
        prefix: 'agro:00000416',
        path: '/agronomicContext/equipment/type',
        release: '2022-11-02',
        source: 'https://github.com/AgriculturalSemantics/agro',
        license: 'CC BY 4.0',
    },
    {
        ontology: 'ENVO',
        term: 'Soil',
        iri: 'http://purl.obolibrary.org/obo/ENVO_00001998',
        prefix: 'envo:00001998',
        path: '/environmentalContext/material/type',
        release: 'term reference',
        source: 'https://github.com/EnvironmentOntology/envo',
        license: 'CC BY 4.0',
    },
    {
        ontology: 'RESEO',
        term: 'Sentinel 2 product',
        iri: 'https://w3id.org/reseo#Sentinel2Product',
        prefix: 'reseo:Sentinel2Product',
        path: '/remoteSensingContext/product/type',
        release: '1.0',
        source: 'https://github.com/KhaosResearch/REmoteSEnsingOntology',
        license: 'MIT',
    },
    {
        ontology: 'RESEO',
        term: 'Has data source',
        iri: 'https://w3id.org/reseo#hasDataSource',
        prefix: 'reseo:hasDataSource',
        path: '/remoteSensingContext/product/hasDataSource',
        release: '1.0',
        source: 'https://github.com/KhaosResearch/REmoteSEnsingOntology',
        license: 'MIT',
    },
    {
        ontology: 'RESEO',
        term: 'Data source',
        iri: 'https://w3id.org/reseo#DataSource',
        prefix: 'reseo:DataSource',
        path: '/remoteSensingContext/product/hasDataSource/type',
        release: '1.0',
        source: 'https://github.com/KhaosResearch/REmoteSEnsingOntology',
        license: 'MIT',
    },
] as const;
export function claimSemantics(subjectId: string, productId: string) {
    return {
        '@context': claimContext,
        agronomicContext: {
            equipment: { id: subjectId + ':drill', type: 'agro:00000416', label: 'Demonstration no-till drill' },
            practice: {
                id: subjectId + ':practice',
                type: 'dmrv:NoTillPractice',
                label: 'Illustrative reduced soil disturbance; practice class is a demo extension, not an invented AgrO term.',
            },
        },
        environmentalContext: { material: { id: subjectId + ':soil', type: 'envo:00001998', label: 'Soil' }, samplingDepth: { value: 30, unit: 'cm' } },
        remoteSensingContext: {
            product: {
                id: productId,
                type: 'reseo:Sentinel2Product',
                hasDataSource: { id: productId + ':source', type: 'reseo:DataSource', label: 'Synthetic Sentinel-2 MSI context record' },
            },
        },
        ontologyReferences: ontologyTerms,
    };
}
