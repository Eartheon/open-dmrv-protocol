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
    hasProduct: { '@id': 'reseo:hasProduct' },
    cloudCoverPercent: { '@id': 'reseo:cloudcoverpercentage' },
    requestedProductType: { '@id': 'dmrv:requestedProductType', '@type': '@id' },
    requestedDataSourceType: { '@id': 'dmrv:requestedDataSourceType', '@type': '@id' },
    requestedImageType: { '@id': 'dmrv:requestedImageType', '@type': '@id' },
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
    { ontology: 'RESEO', term: 'Sentinel 2 satellite', iri: 'https://w3id.org/reseo#Sentinel2', prefix: 'reseo:Sentinel2', path: '/remoteSensingContext/product/hasDataSource/type', release: '1.0', source: 'https://github.com/KhaosResearch/REmoteSEnsingOntology', license: 'MIT' },
    { ontology: 'RESEO', term: 'Raster image', iri: 'https://w3id.org/reseo#RasterImage', prefix: 'reseo:RasterImage', path: '/remoteSensingContext/product/image/type', release: '1.0', source: 'https://github.com/KhaosResearch/REmoteSEnsingOntology', license: 'MIT' },
    { ontology: 'RESEO', term: 'Snapshot', iri: 'https://w3id.org/reseo#Snapshot', prefix: 'reseo:Snapshot', path: '/remoteSensingContext/snapshot/type', release: '1.0', source: 'https://github.com/KhaosResearch/REmoteSEnsingOntology', license: 'MIT' },
    { ontology: 'RESEO', term: 'Has product', iri: 'https://w3id.org/reseo#hasProduct', prefix: 'reseo:hasProduct', path: '/remoteSensingContext/snapshot/hasProduct', release: '1.0', source: 'https://github.com/KhaosResearch/REmoteSEnsingOntology', license: 'MIT' },
    { ontology: 'RESEO', term: 'Cloud cover percentage', iri: 'https://w3id.org/reseo#cloudcoverpercentage', prefix: 'reseo:cloudcoverpercentage', path: '/remoteSensingContext/snapshot/cloudCoverPercent', release: '1.0', source: 'https://github.com/KhaosResearch/REmoteSEnsingOntology', license: 'MIT' },
] as const;
export function claimSemantics(subjectId: string, productId: string, modalities = { manualStudy: true, satelliteCapture: true }, depths = [30]) {
    return {
        '@context': claimContext,
        ...(modalities.manualStudy ? { agronomicContext: {
            equipment: { id: subjectId + ':drill', type: 'agro:00000416', label: 'Demonstration no-till drill' },
            practice: {
                id: subjectId + ':practice',
                type: 'dmrv:NoTillPractice',
                label: 'Illustrative reduced soil disturbance; practice class is a demo extension, not an invented AgrO term.',
            },
        } } : {}),
        environmentalContext: { material: { id: subjectId + ':soil', type: 'envo:00001998', label: 'Soil' }, ...(modalities.manualStudy ? { samplingDepths: depths.map(value => ({ value, unit: 'cm' })) } : {}) },
        ...(modalities.satelliteCapture ? { remoteSensingContext: {
            product: {
                id: productId,
                type: 'reseo:Sentinel2Product',
                hasDataSource: { id: productId + ':source', type: ['reseo:DataSource', 'reseo:Sentinel2'], label: 'Synthetic Sentinel-2 MSI source' },
            },
        } } : {}),
        ontologyReferences: ontologyTerms.filter(t => t.ontology === 'ENVO' || (t.ontology === 'AgrO' ? modalities.manualStudy : modalities.satelliteCapture)),
    };
}

export function semanticFields(document: Record<string, any>) {
    return Object.fromEntries(['@context', 'agronomicContext', 'environmentalContext', 'remoteSensingContext', 'ontologyReferences']
        .filter(key => document[key] !== undefined).map(key => [key, document[key]]));
}
