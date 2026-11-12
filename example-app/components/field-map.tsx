'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl';
import type { Polygon } from 'geojson';
import { parcels, areaHa } from '@/lib/model';

export function FieldMap({ selected, onSelect, compact = false }: { selected: string; onSelect?: (id: string) => void; compact?: boolean }) {
    const container = useRef<HTMLDivElement>(null),
        map = useRef<MapboxMap | null>(null),
        selectRef = useRef(onSelect),
        selectedRef = useRef(selected);
    selectRef.current = onSelect;
    selectedRef.current = selected;
    const [token, setToken] = useState(''),
        [draft, setDraft] = useState(''),
        [error, setError] = useState(''),
        [edit, setEdit] = useState(false);
    const field = parcels.find((p) => p.id === selected) || parcels[0];
    useEffect(() => {
        setToken(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || localStorage.getItem('dmrv-mapbox-token') || '');
    }, []);
    const collection = () => ({
        type: 'FeatureCollection' as const,
        features: parcels.map((p) => ({
            type: 'Feature' as const,
            id: p.id,
            properties: { id: p.id, name: p.name, selected: p.id === selectedRef.current },
            geometry: p.geometry as Polygon,
        })),
    });
    useEffect(() => {
        if (!token || !container.current) return;
        let disposed = false;
        setError('');
        import('mapbox-gl')
            .then(({ default: mapboxgl }) => {
                if (disposed) return;
                try {
                    const instance = new mapboxgl.Map({
                        container: container.current!,
                        accessToken: token,
                        style: process.env.NEXT_PUBLIC_MAPBOX_STYLE || 'mapbox://styles/mapbox/standard',
                        config: { basemap: { lightPreset: 'day', showPointOfInterestLabels: false } },
                        center: [79.0847, 10.7741],
                        zoom: 14.8,
                        attributionControl: true,
                    });
                    map.current = instance;
                    instance.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
                    instance.on('error', () => setError('Mapbox could not load. Check the token, URL restrictions and network connection.'));
                    instance.on('load', () => {
                        if (disposed) return;
                        instance.addSource('fields', { type: 'geojson', data: collection() });
                        instance.addLayer({
                            id: 'field-fill',
                            type: 'fill',
                            source: 'fields',
                            paint: {
                                'fill-color': ['case', ['get', 'selected'], '#cbdca5', '#ffffff'],
                                'fill-opacity': ['case', ['get', 'selected'], 0.35, 0.12],
                            },
                        });
                        instance.addLayer({
                            id: 'field-border',
                            type: 'line',
                            source: 'fields',
                            paint: { 'line-color': ['case', ['get', 'selected'], '#e7ff9b', '#ffffff'], 'line-width': ['case', ['get', 'selected'], 3, 1.5] },
                        });
                        instance.addLayer({
                            id: 'field-label',
                            type: 'symbol',
                            source: 'fields',
                            layout: { 'text-field': ['get', 'name'], 'text-size': 12 },
                            paint: { 'text-color': '#fff', 'text-halo-color': '#243c2a', 'text-halo-width': 2 },
                        });
                        instance.on('click', 'field-fill', (e) => {
                            const id = e.features?.[0]?.properties?.id;
                            if (id) selectRef.current?.(id);
                        });
                        instance.on('mouseenter', 'field-fill', () => {
                            instance.getCanvas().style.cursor = selectRef.current ? 'pointer' : 'default';
                        });
                        instance.on('mouseleave', 'field-fill', () => {
                            instance.getCanvas().style.cursor = '';
                        });
                        instance.fitBounds(
                            [
                                [79.0788, 10.7693],
                                [79.091, 10.779],
                            ],
                            { padding: 35, duration: 0 }
                        );
                    });
                } catch {
                    setError('Mapbox requires WebGL. Enable browser hardware acceleration to view the map.');
                }
            })
            .catch(() => setError('Mapbox could not initialise.'));
        return () => {
            disposed = true;
            map.current?.remove();
            map.current = null;
        };
        // Each instance reads current selection from refs when the asynchronous map finishes loading.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);
    useEffect(() => {
        const source = map.current?.getSource('fields') as GeoJSONSource | undefined;
        source?.setData(collection());
    }, [selected]);
    const points = field.geometry.coordinates[0]
        .map(([lon, lat]) => `${40 + ((lon - 79.0788) / 0.0122) * 520},${300 - ((lat - 10.7693) / 0.0097) * 260}`)
        .join(' ');
    return (
        <section className={'field-map ' + (compact ? 'compact' : '')} aria-label='Mapbox land parcel map'>
            <div ref={container} className='map-container' />
            {!token && (
                <div className='coordinate-preview'>
                    <div className='preview-label'>GEOGRAPHIC BOUNDARY PREVIEW</div>
                    <svg viewBox='0 0 600 340' role='img' aria-label={`GeoJSON outline of ${field.name}; basemap awaits Mapbox token`}>
                        <defs>
                            <pattern id='coordinate-grid' width='60' height='44' patternUnits='userSpaceOnUse'>
                                <path d='M 60 0 L 0 0 0 44' fill='none' stroke='#91a38c' strokeWidth='.6' />
                            </pattern>
                        </defs>
                        <rect width='600' height='340' fill='url(#coordinate-grid)' />
                        <polygon points={points} fill='#cbdca5' fillOpacity='.4' stroke='#e4f3bd' strokeWidth='2' />
                        <text x='20' y='325' fill='#d7e0d4' fontSize='10'>
                            79.0788° E
                        </text>
                        <text x='502' y='325' fill='#d7e0d4' fontSize='10'>
                            79.0910° E
                        </text>
                        <text x='20' y='45' fill='#d7e0d4' fontSize='10'>
                            10.7790° N
                        </text>
                    </svg>
                    <div className='preview-caption'>
                        <b>Real coordinates. Mapbox ready.</b>
                        <span>Add your token to load satellite imagery.</span>
                    </div>
                </div>
            )}
            <div className='map-heading'>
                <span className='live-dot' /> THANJAVUR · TAMIL NADU <span>OGC:CRS84</span>
            </div>
            {error && (
                <div className='map-error' role='alert'>
                    {error}
                </div>
            )}
            <div className='map-bottom'>
                <div>
                    <strong>{field.name}</strong>
                    <span>
                        {areaHa(field.geometry)} ha · {field.geometry.coordinates[0][0][1].toFixed(4)}° N, {field.geometry.coordinates[0][0][0].toFixed(4)}° E
                    </span>
                </div>
                <button className='map-key' onClick={() => setEdit(!edit)}>
                    Mapbox settings
                </button>
            </div>
            {edit && (
                <div className='token-editor'>
                    <label htmlFor='map-token'>Public Mapbox token</label>
                    <input id='map-token' value={draft} onChange={(e) => setDraft(e.target.value)} placeholder='pk.…' />
                    <button
                        onClick={() => {
                            if (draft.startsWith('pk.')) {
                                localStorage.setItem('dmrv-mapbox-token', draft);
                                setToken(draft);
                                setEdit(false);
                            } else setError('Use a public browser token beginning with pk.');
                        }}
                    >
                        Load map
                    </button>
                    <small>Stored in this browser. You can also set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in .env.local.</small>
                </div>
            )}
            <span className='map-disclaimer'>Demonstration polygons at real locations; boundaries are not cadastral records.</span>
        </section>
    );
}
