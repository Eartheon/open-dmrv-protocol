'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { roles, parcels, areaHa, methodology, actionRole } from '@/lib/model';
import { journeySteps, roleForStep, stageIndex } from '@/lib/journey';
import { correctionFailure, monitoringDraftFor, stepState } from '@/lib/journey-state';
import type { MonitoringDraft } from '@/lib/journey-state';
import { ontologyTerms } from '@/lib/semantics';
import { FieldMap } from './field-map';
import type { Doc, RoleId, Action } from '@/lib/model';

async function call(path: string, body?: unknown) {
    const response = await fetch(path, {
        method: body === undefined ? 'GET' : 'POST',
        credentials: 'same-origin',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (!response.ok) throw Error((data.error?.code || response.status) + ': ' + (data.error?.message || 'Request failed'));
    return data;
}
const enter = (profile: string) => call('/api/session', { profile });
const label = (value: string) => value.replaceAll('_', ' ');
const stamp = (value: string) => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const short = (value?: string) => (value ? (value.length > 30 ? value.slice(0, 26) + '…' : value) : 'Pending');
function Pill({ children, tone = 'green' }: { children: React.ReactNode; tone?: string }) {
    return <span className={'v-pill ' + tone}>{children}</span>;
}
function Topbar({ title = 'Protocol in practice', profile }: { title?: string; profile?: RoleId }) {
    return (
        <header className='v-topbar'>
            <Link className='v-wordmark' href='/'>
                Open <b>dMRV</b>
                <span>PROTOCOL IN PRACTICE</span>
            </Link>
            <nav>
                <Link href='/projects/new'>New project</Link>
                <Link href='/projects'>Browse projects</Link>
                <Link href='/carbon'>Applications</Link>
            </nav>
            <span className='v-profile-label'>{profile ? roles.find((r) => r.id === profile)?.name : title}</span>
        </header>
    );
}
function ErrorBox({ message }: { message: string }) {
    return message ? (
        <div className='v-error' role='alert'>
            {message}
        </div>
    ) : null;
}
function Json({ value }: { value: unknown }) {
    return <pre className='v-json'>{JSON.stringify(value ?? { message: 'This exchange has not happened yet.' }, null, 2)}</pre>;
}
function useProject(id: string, profile: RoleId) {
    const [data, setData] = useState<Doc | null>(null),
        [error, setError] = useState('');
    const refresh = useCallback(async () => {
        try {
            setData(await call('/api/projects/' + id));
        } catch (e) {
            setError((e as Error).message);
        }
    }, [id]);
    useEffect(() => {
        let active = true;
        enter(profile)
            .then(() => {
                if (active) void refresh();
            })
            .catch((e) => setError(e.message));
        const timer = setInterval(() => {
            if (active) void refresh();
        }, 1800);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [profile, refresh]);
    return { data, error, setError, refresh };
}

export function Home() {
    return (
        <>
            <Topbar />
            <main id='main'>
                <section className='v-home-hero'>
                    <div className='hero-grid' />
                    <p className='eyebrow'>AN ENVIRONMENTAL CLAIM, FROM START TO FINISH</p>
                    <h1>
                        See how
                        <br />
                        trust is built.
                    </h1>
                    <p>
                        Open dMRV connects the people who collect evidence, make a claim, check it and endorse it. Walk through one project to see every
                        handoff.
                    </p>
                    <Link href='#context' className='v-button light'>
                        Browse applications <span>→</span>
                    </Link>
                    <div className='v-five-actions'>
                        {['Register', 'Monitor', 'Report', 'Verify', 'Attest'].map((s, i) => (
                            <span key={s}>
                                <b>0{i + 1}</b>
                                {s}
                            </span>
                        ))}
                    </div>
                </section>
                <section id='context' className='v-home-content'>
                    <div className='v-section-heading'>
                        <div>
                            <p className='eyebrow'>CHOOSE YOUR CONTEXT</p>
                            <h2>One protocol. Different applications.</h2>
                        </div>
                        <p>
                            Start a new journey or inspect an existing record.
                            <br />
                            You can pause and return at any step.
                        </p>
                    </div>
                    <div className='v-context-grid'>
                        <article>
                            <Pill>AVAILABLE</Pill>
                            <h3>Carbon Markets</h3>
                            <p>Follow a soil-carbon claim from a real mapped location to an educational attestation. Measurements and parties are fictional.</p>
                            <Link href='/projects/new' className='v-button'>
                                Start the soil-carbon journey →
                            </Link>
                            <Link href='/projects' className='v-button' style={{ marginLeft: '20px' }}>
                                Or browse existing projects ↗
                            </Link>
                        </article>
                        <article className='muted-context'>
                            <Pill tone='neutral'>COMING SOON</Pill>
                            <h3>Digital Twins</h3>
                            <p>Use the same protocol to assure environmental observations and releases in a digital twin.</p>
                            <button className='v-button secondary' disabled>
                                Coming soon
                            </button>
                        </article>
                    </div>
                    <div className='v-short-guide'>
                        <div>
                            <b>01</b>
                            <h3>You have one task at a time.</h3>
                            <p>Each application explains your current role and the next action.</p>
                        </div>
                        <div>
                            <b>02</b>
                            <h3>Watch the real API exchange.</h3>
                            <p>Inspect the signed request, immediate ACK and later callback.</p>
                        </div>
                        <div>
                            <b>03</b>
                            <h3>Try changing earlier data.</h3>
                            <p>A failed check returns the project to the step that can correct it.</p>
                        </div>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    );
}
function Footer() {
    return (
        <footer className='v-footer'>
            <span>Open dMRV · Eartheon / Forum for Urban Informatics</span>
            <span>Discussion draft v0.0.1 · Educational reference</span>
        </footer>
    );
}

export function NewProject() {
    const router = useRouter();
    const [name, setName] = useState('Kaveri soil-carbon project'),
        [selected, setSelected] = useState(parcels[0].id),
        [busy, setBusy] = useState(false),
        [error, setError] = useState('');
    async function create() {
        setBusy(true);
        setError('');
        try {
            await enter('controller');
            const p = await call('/api/projects', { name, parcelId: selected, domain: 'carbon' });
            router.push('/projects/' + p.id + '/journey');
        } catch (e) {
            setError((e as Error).message);
            setBusy(false);
        }
    }
    return (
        <>
            <Topbar />
            <main id='main' className='v-page'>
                <Link className='v-back' href='/'>
                    ← Choose a context
                </Link>
                <div className='v-page-title'>
                    <p className='eyebrow'>NEW PROJECT / CARBON MARKETS</p>
                    <h1>Begin with a place.</h1>
                    <p>Name your project and choose a field. We’ll guide you through the rest.</p>
                </div>
                <ErrorBox message={error} />
                <div className='v-new-project'>
                    <div>
                        <FieldMap selected={selected} onSelect={setSelected} />
                        <div className='v-field-choices'>
                            {parcels.map((p) => (
                                <button key={p.id} onClick={() => setSelected(p.id)} className={selected === p.id ? 'active' : ''}>
                                    <b>{p.name}</b>
                                    <span>{areaHa(p.geometry)} hectares</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <section className='v-card v-create-card'>
                        <label htmlFor='project-name'>Project name</label>
                        <input id='project-name' maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
                        <div className='v-selected-field'>
                            <Pill>SELECTED FIELD</Pill>
                            <h2>{parcels.find((p) => p.id === selected)?.name}</h2>
                            <p>Thanjavur, Tamil Nadu · WGS84 coordinates</p>
                        </div>
                        <ol className='v-preview-steps'>
                            {journeySteps.map((s, i) => (
                                <li key={s.id}>
                                    <span>{i + 1}</span>
                                    <div>
                                        <b>{s.label}</b>
                                        <small>{roles.find((r) => r.id === s.role)?.title}</small>
                                    </div>
                                </li>
                            ))}
                        </ol>
                        <button disabled={busy || name.trim().length < 2} className='v-button' onClick={create}>
                            {busy ? 'Creating in Postgres…' : 'Create project & start walkthrough →'}
                        </button>
                        <p className='v-small'>Demonstration polygons at real locations. These are not cadastral boundaries or real ownership records.</p>
                    </section>
                </div>
            </main>
            <Footer />
        </>
    );
}

export function Applications() {
    return (
        <>
            <Topbar />
            <main id='main' className='v-page'>
                <div className='v-page-title'>
                    <p className='eyebrow'>APPLICATIONS / BROWSE MODE</p>
                    <h1>Different work. Different perspectives.</h1>
                    <p>Open an application to browse its projects and history. For a step-by-step introduction, start a guided project.</p>
                    <Link href='/projects/new' className='v-button'>
                        Start a guided project →
                    </Link>
                </div>
                <div className='v-app-grid'>
                    {roles.map((r, i) => (
                        <Link href={'/apps/' + r.id} className={'v-app-tile tile-' + r.id} key={r.id}>
                            <span>
                                0{i + 1} / {r.title}
                            </span>
                            <h2>{r.name}</h2>
                            <p>{r.description}</p>
                            <b>Enter as {r.person} ↗</b>
                        </Link>
                    ))}
                </div>
            </main>
            <Footer />
        </>
    );
}

export function ProjectBrowser({ roleId = 'implementer' }: { roleId?: string }) {
    const profile = roles.find((r) => r.id === roleId)!,
        [projects, setProjects] = useState<Doc[]>([]),
        [error, setError] = useState(''),
        [query, setQuery] = useState(''),
        [registry, setRegistry] = useState<Doc[]>([]);
    useEffect(() => {
        enter(profile.id)
            .then(async () => {
                setProjects((await call('/api/projects')).projects);
                if (profile.id === 'registrar') setRegistry((await call('/api/registry')).parties);
            })
            .catch((e) => setError(e.message));
    }, [profile.id]);
    const selected = projects.filter((p) => (p.name + ' ' + p.subject_name).toLowerCase().includes(query.toLowerCase()));
    const copy: Record<string, [string, string]> = {
        controller: ['Your fields, your projects.', 'Manage participation and see what has been claimed about your land.'],
        implementer: ['Project register', 'Coordinate registrations, participants and corrections across your portfolio.'],
        measurement: ['Observation workspace', 'Browse monitoring runs, signed evidence packages and source assets.'],
        reporter: ['Carbon reporting ledger', 'Open a project to inspect evidence, calculations and claim revisions.'],
        verifier: ['Independent review queue', 'Check submissions that need assurance and revisit earlier findings.'],
        attester: ['Attestation archive', 'Browse signed endorsements, their qualifications and complete revision histories.'],
        standards: ['Methodology & vocabulary library', 'The standard defines the science. Ontologies give the claim a shared meaning.'],
        registrar: ['Network trust registry', 'Resolve accountable parties, registered agents and public signing keys.'],
    };
    return (
        <div className={'v-front front-' + profile.id}>
            <Topbar profile={profile.id} />
            <main id='main' className='v-page'>
                <section className='v-front-hero'>
                    <div>
                        <p className='eyebrow'>
                            {profile.name.toUpperCase()} / {profile.role}
                        </p>
                        <h1>{copy[profile.id][0]}</h1>
                        <p>{copy[profile.id][1]}</p>
                        <div className='v-person'>
                            {profile.person} · {profile.org}
                        </div>
                    </div>
                    <Link className='v-button' href='/projects/new'>
                        New guided project +
                    </Link>
                </section>
                <ErrorBox message={error} />
                {profile.id === 'standards' && (
                    <>
                        <div className='v-standards-grid'>
                            <section className='v-card'>
                                <Pill tone='amber'>EXTERNAL STANDARD</Pill>
                                <h2>Gold Standard SOC Framework</h2>
                                <p>
                                    Version 1.0 is the pinned historical reference. The demo’s calculation is a separate teaching profile, not an approved
                                    certification calculation.
                                </p>
                                <a href={methodology.id} target='_blank' rel='noreferrer'>
                                    Open the methodology source ↗
                                </a>
                                <a href={methodology.alignment} target='_blank' rel='noreferrer'>
                                    Check current programme alignment ↗
                                </a>
                            </section>
                            <section className='v-card'>
                                <Pill>DEMO CALCULATION</Pill>
                                <h2>Soil stock change, made visible.</h2>
                                <p>
                                    Paired samples, sampling depth, density, coarse fragments and area feed a reproducible estimate. Fixed deductions and a
                                    buffer are explicitly illustrative.
                                </p>
                                <p className='v-small'>No additionality finding, programme certification or credit issuance is implied.</p>
                            </section>
                        </div>
                        <OntologyView />
                    </>
                )}
                {profile.id === 'registrar' && (
                    <section className='v-card'>
                        <div className='v-table-wrap'>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Party / profile</th>
                                        <th>Role</th>
                                        <th>Verification method</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {registry.map((r) => (
                                        <tr key={r.id}>
                                            <td>
                                                <b>{r.name}</b>
                                                <small>{r.person_name}</small>
                                            </td>
                                            <td>{r.role}</td>
                                            <td>
                                                <code>{short(r.verification_method)}</code>
                                            </td>
                                            <td>
                                                <Pill tone={r.revoked_at ? 'red' : 'green'}>{r.revoked_at ? 'Revoked' : 'Active'}</Pill>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}
                <div className='v-archive-toolbar'>
                    <div>
                        <h2>{profile.id === 'attester' ? 'Projects & attestation revisions' : 'Project portfolio'}</h2>
                        <span>{projects.length} projects · browsing outside the walkthrough</span>
                    </div>
                    <input aria-label='Search projects' placeholder='Search projects or fields…' value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                {selected.length ? (
                    <div className={'v-project-list list-' + profile.id}>
                        {selected.map((p) => (
                            <Link className='v-project-row' key={p.id} href={'/projects/' + p.id + '?profile=' + profile.id}>
                                <div className='v-project-number'>
                                    {profile.id === 'controller' ? '◈' : profile.id === 'attester' ? '✓' : profile.id === 'verifier' ? '?' : '↗'}
                                </div>
                                <div className='v-project-summary'>
                                    <b>{p.name}</b>
                                    <span>
                                        {p.subject_name} · {Number(p.area_ha).toFixed(2)} ha
                                    </span>
                                </div>
                                <div>
                                    <Pill tone={p.correction ? 'amber' : p.next_action === 'complete' ? 'green' : 'neutral'}>
                                        {p.correction ? 'Correction needed' : p.next_action === 'complete' ? 'Attested' : 'Next: ' + p.next_action}
                                    </Pill>
                                    <small>Updated {stamp(p.updated_at)}</small>
                                </div>
                                <div className='v-project-revisions'>
                                    <b>{p.attestation_revisions}</b>
                                    <span>attestation versions</span>
                                </div>
                                <span>Open →</span>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className='v-empty'>
                        <h3>{query ? 'No matching projects.' : 'Your first project starts here.'}</h3>
                        <p>Create a guided project to see registration, evidence, claims and callbacks in context.</p>
                        <Link className='v-button' href='/projects/new'>
                            Start a project →
                        </Link>
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
}

export function Journey({ projectId }: { projectId: string }) {
    const [stepId, setStepId] = useState('consent'),
        [initial, setInitial] = useState(true),
        [busy, setBusy] = useState(false),
        [agreed, setAgreed] = useState(false),
        [prepared, setPrepared] = useState<Doc | null>(null),
        [notice, setNotice] = useState(''),
        [fudge, setFudge] = useState(false),
        [target, setTarget] = useState(''),
        [edit, setEdit] = useState(''),
        [quantity, setQuantity] = useState(''),
        [editedMonitoring, setEditedMonitoring] = useState<MonitoringDraft | null>(null);
    const profile = roleForStep(stepId),
        role = roles.find((r) => r.id === profile)!,
        step = journeySteps.find((s) => s.id === stepId) || journeySteps[5];
    const { data, error, setError, refresh } = useProject(projectId, profile);
    const monitoring = monitoringDraftFor(data, projectId, editedMonitoring),
        { samples, cloudCoverPercent: cloud } = monitoring;
    useEffect(() => {
        if (data && initial) {
            setStepId(data.project.next_action === 'complete' ? 'attest' : data.project.next_action);
            setInitial(false);
        }
    }, [data, initial]);
    useEffect(() => {
        setPrepared(null);
        setFudge(false);
        setTarget('');
        setEdit('');
        setNotice('');
        setQuantity('');
    }, [stepId]);
    const doc = data?.current[stepId]?.document,
        prior = data ? Object.entries(data.current).filter(([id]) => stageIndex(id) < stageIndex(stepId)) : [];
    const request = data?.messages.find((m: Doc) => m.direction === 'request' && m.action === stepId),
        callback = request ? data?.messages.find((m: Doc) => m.correlation_id === request.message_id) : null;
    const delivered = callback?.status === 'delivered',
        failed = request?.business_outcome === 'failed' || callback?.business_outcome === 'failed',
        completed = data?.project.next_action !== stepId && (stepId === 'consent' ? !!doc : delivered && callback?.business_outcome === 'completed' && !!doc);
    const pending = !!data?.project.pending_message_id,
        canAct = data?.project.next_action === stepId && !pending;
    async function task(fn: () => Promise<void>) {
        setBusy(true);
        setError('');
        try {
            await enter(profile);
            await fn();
            await refresh();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }
    async function prepare() {
        await task(async () => {
            const overrides: Doc = {};
            if (fudge && target) {
                if (target.startsWith('asset:')) overrides.assetOverrides = { [target.slice(6)]: edit };
                else overrides[target] = JSON.parse(edit);
            }
            const response = await call('/api/projects/' + projectId + '/sign', {
                action: stepId,
                values: { samples, cloudCoverPercent: cloud, netTCO2e: quantity === '' ? null : Number(quantity) },
                overrides,
            });
            setPrepared(response);
            setNotice('Request signed. Inspect its JSON, then send it to ' + response.endpoint + '.');
        });
    }
    async function send() {
        if (!prepared) return;
        await task(async () => {
            const response = await fetch(prepared.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/vnd.open-dmrv+json;version=0.0.1', 'Idempotency-Key': prepared.envelope.context.messageId },
                body: JSON.stringify(prepared.envelope),
            });
            const ack = await response.json();
            if (!response.ok) throw Error(ack.error?.code + ': ' + ack.error?.message);
            setNotice('HTTP 202 ACK received. Waiting for the separate ' + ('/on_' + stepId) + ' callback…');
            setPrepared(null);
        });
    }
    function chooseTarget(value: string) {
        setTarget(value);
        if (value.startsWith('asset:')) {
            setEdit('Change this asset content to simulate a substituted file.');
        } else setEdit(JSON.stringify(data?.current[value]?.document, null, 2));
        setPrepared(null);
    }
    function goNext() {
        setStepId(data!.project.next_action === 'complete' ? 'attest' : data!.project.next_action);
        setPrepared(null);
    }
    if (!data)
        return (
            <>
                <Topbar />
                <main id='main' className='v-page'>
                    <ErrorBox message={error} />
                    <p>Opening the project journey…</p>
                </main>
            </>
        );
    const failure = correctionFailure(data);
    return (
        <div className={'v-journey journey-' + profile}>
            <Topbar profile={profile} />
            <main id='main'>
                <div className='v-journey-meta'>
                    <Link href={'/projects/' + projectId + '?profile=' + profile}>← Exit to project archive</Link>
                    <span>{data.project.name}</span>
                    <Pill tone='neutral'>Saved in Postgres · revision {data.project.revision}</Pill>
                </div>
                <nav className='v-stepper' aria-label='Project walkthrough'>
                    {journeySteps.map((s, i) => {
                        const status = stepState(data, s.id);
                        return (
                            <button
                                disabled={stageIndex(s.id) > stageIndex(data.project.next_action) && data.project.next_action !== 'complete'}
                                key={s.id}
                                onClick={() => setStepId(s.id)}
                                className={[stepId === s.id ? 'active' : '', status === 'complete' ? 'done' : status].join(' ')}
                                aria-label={s.label + ' · ' + (status === 'failed' ? 'Request failed' : status === 'complete' ? 'Completed' : status === 'pending' ? 'Awaiting callback' : 'Not completed')}
                            >
                                <span aria-hidden='true'>{status === 'complete' ? '✓' : status === 'failed' ? '!' : i + 1}</span>
                                <b>{s.label}</b>
                                <small>{status === 'failed' ? 'Request failed' : s.id === 'consent' ? 'authorisation' : '/' + s.id}</small>
                            </button>
                        );
                    })}
                </nav>
                <div className='v-journey-layout'>
                    <div className='v-task-area'>
                        <section className='v-role-banner'>
                            <div className='v-role-masthead'>
                                <span>{role.name.toUpperCase()}</span>
                                <span>
                                    {role.person} / {role.title}
                                </span>
                            </div>
                            <p className='eyebrow'>STEP {stageIndex(stepId) + 1} OF 6</p>
                            <h1>{step.title}</h1>
                            <p>{step.explanation}</p>
                            <div className='v-one-task'>
                                <b>Your task</b>
                                <span>{step.task}</span>
                            </div>
                        </section>
                        <div className='v-task-content'>
                            <ErrorBox message={error} />
                            {data.project.correction && (
                                <div className='v-correction' role='alert'>
                                    <Pill tone='red'>{failure ? 'REQUEST FAILED' : 'CORRECTION REQUIRED'}</Pill>
                                    <h3>{failure ? 'Your /' + failure.action + ' request failed.' : 'A corrected revision is needed.'}</h3>
                                    <code>{data.project.correction.code}</code>
                                    <p>{data.project.correction.message}</p>
                                    <span>
                                        Return to <b>{data.project.correction.retryFrom}</b>. A corrected submission creates a new signed version.
                                    </span>
                                    {stepId !== data.project.correction.retryFrom && (
                                        <button className='v-button' onClick={() => setStepId(data.project.correction.retryFrom)}>
                                            Open the correction step →
                                        </button>
                                    )}
                                </div>
                            )}
                            {stepId === 'consent' && (
                                <>
                                    <FieldMap selected={data.project.parcel_id} />
                                    <section className='v-card'>
                                        <h2>{data.subject.name}</h2>
                                        <p>{Number(data.subject.area_ha).toFixed(2)} ha · Thanjavur, Tamil Nadu</p>
                                        <label className='v-check'>
                                            <input type='checkbox' checked={agreed || !!doc} disabled={!!doc} onChange={(e) => setAgreed(e.target.checked)} />
                                            <span>
                                                I authorise this demonstration field to participate and permit the named providers to use its synthetic
                                                evidence.
                                            </span>
                                        </label>
                                        <button
                                            className='v-button'
                                            disabled={busy || !agreed || !canAct}
                                            onClick={() =>
                                                task(async () => {
                                                    await call('/api/projects/' + projectId + '/consent', {});
                                                    setNotice('The land steward’s signed authorisation is saved. Continue to registration.');
                                                })
                                            }
                                        >
                                            {step.button} →
                                        </button>
                                    </section>
                                </>
                            )}
                            {stepId === 'register' && (
                                <section className='v-registration-packet'>
                                    <div className='v-packet-heading'>
                                        <span>PROJECT REGISTRATION PACKET</span>
                                        <b>{data.project.id.slice(0, 8).toUpperCase()}</b>
                                    </div>
                                    <h2>{data.project.name}</h2>
                                    <dl>
                                        <div>
                                            <dt>Monitored subject</dt>
                                            <dd>
                                                {data.subject.name} · {Number(data.subject.area_ha).toFixed(2)} ha
                                            </dd>
                                        </div>
                                        <div>
                                            <dt>Permission</dt>
                                            <dd>Signed by {roles[0].person}</dd>
                                        </div>
                                        <div>
                                            <dt>Standards Authority</dt>
                                            <dd>Gold Standard · SOC Framework v1.0</dd>
                                        </div>
                                        <div>
                                            <dt>Calculation profile</dt>
                                            <dd>Educational soil-stock profile v1.0</dd>
                                        </div>
                                        <div>
                                            <dt>Assigned participants</dt>
                                            <dd>{roles.length} accountable parties</dd>
                                        </div>
                                    </dl>
                                    <div className='v-participant-chips'>
                                        {roles.map((r) => (
                                            <span key={r.id}>
                                                {r.name}
                                                <small>{r.role}</small>
                                            </span>
                                        ))}
                                    </div>
                                    <p className='v-small'>Registration establishes identity and context. It does not approve a scientific result.</p>
                                </section>
                            )}
                            {stepId === 'monitor' && (
                                <>
                                    <section className='v-lab-panel'>
                                        <div className='v-lab-title'>
                                            <div>
                                                <span>OBSERVATION BATCH</span>
                                                <h2>Paired soil samples</h2>
                                            </div>
                                            <Pill tone='neutral'>Synthetic observations</Pill>
                                        </div>
                                        <div className='v-table-wrap'>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Sample</th>
                                                        <th>Baseline SOC %</th>
                                                        <th>Current SOC %</th>
                                                        <th>Density g/cm³</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {samples.map((s, i) => (
                                                        <tr key={s.sample}>
                                                            <td>{s.sample}</td>
                                                            {(['baselineSocPct', 'currentSocPct', 'bulkDensity'] as const).map((key) => (
                                                                <td key={key}>
                                                                    <input
                                                                        aria-label={s.sample + ' ' + key}
                                                                        type='number'
                                                                        step='0.01'
                                                                        value={s[key]}
                                                                        disabled={!canAct}
                                                                        onChange={(e) => {
                                                                            setPrepared(null);
                                                                            setEditedMonitoring({ ...monitoring, samples: samples.map((row, j) => (j === i ? { ...row, [key]: Number(e.target.value) } : row)) });
                                                                        }}
                                                                    />
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className='v-lab-metrics'>
                                            <span>
                                                Depth <b>{!samples.length ? 'No samples' : samples.every((s) => s.depthCm === samples[0].depthCm) ? '0–' + samples[0].depthCm + ' cm' : 'Varies by sample'}</b>
                                            </span>
                                            <span>
                                                Coarse fragments <b>{!samples.length ? 'No samples' : samples.every((s) => s.rockFraction === samples[0].rockFraction) ? +(samples[0].rockFraction * 100).toFixed(2) + '%' : 'Varies by sample'}</b>
                                            </span>
                                            <span>
                                                Sampling <b>{samples.length} paired samples</b>
                                            </span>
                                        </div>
                                        <label className='v-inline-field'>
                                            Satellite cloud cover %
                                            <input
                                                type='number'
                                                min='0'
                                                max='100'
                                                value={cloud}
                                                disabled={!canAct}
                                                onChange={(e) => {
                                                    setEditedMonitoring({ ...monitoring, cloudCoverPercent: Number(e.target.value) });
                                                    setPrepared(null);
                                                }}
                                            />
                                        </label>
                                        <p className='v-small'>
                                            The signed manifest will reference a CSV, field boundary, practice record and satellite context. Each asset gets a
                                            custodian signature and a byte hash.
                                        </p>
                                    </section>
                                    <FieldMap selected={data.project.parcel_id} compact />
                                </>
                            )}
                            {stepId === 'report' && (
                                <>
                                    <section className='v-ledger-sheet'>
                                        <div className='v-ledger-header'>
                                            <span>CARBON ANALYTICS / CALCULATION WORKSHEET</span>
                                            <b>tCO₂e</b>
                                        </div>
                                        <h2>
                                            From observations
                                            <br />
                                            to an accountable claim.
                                        </h2>
                                        <div className='v-formula'>
                                            ΔSOC × area × 44/12
                                            <br />
                                            <span>− project emissions − leakage</span>
                                            <br />× (1 − buffer)
                                        </div>
                                        <label>
                                            Claim quantity <small>Leave empty to calculate from retrieved evidence.</small>
                                            <input
                                                type='number'
                                                step='0.0001'
                                                placeholder='Automatic from source data'
                                                value={quantity}
                                                disabled={!canAct}
                                                onChange={(e) => {
                                                    setQuantity(e.target.value);
                                                    setPrepared(null);
                                                }}
                                            />
                                        </label>
                                        <p className='v-small'>
                                            You can deliberately enter an incorrect quantity. Your signature will be valid, but the independent verifier will
                                            request a correction.
                                        </p>
                                    </section>
                                    <AssetBrowser data={data} profile={profile} />
                                </>
                            )}
                            {stepId === 'verify' && (
                                <>
                                    <section className='v-review-desk'>
                                        <div className='v-review-heading'>
                                            <Pill tone='amber'>INDEPENDENT ASSURANCE</Pill>
                                            <h2>
                                                Check the source.
                                                <br />
                                                Then check the claim.
                                            </h2>
                                        </div>
                                        <ul>
                                            {[
                                                'Resolve the reporting party and its registered key',
                                                'Validate every upstream signature and revision digest',
                                                'Retrieve the original assets and methodology',
                                                'Compare exact file hashes',
                                                'Reproduce the carbon calculation',
                                                'Assess the demo quality profile',
                                            ].map((s, i) => (
                                                <li key={s}>
                                                    <span>0{i + 1}</span>
                                                    {s}
                                                </li>
                                            ))}
                                        </ul>
                                        {doc?.findings && (
                                            <div className='v-review-findings'>
                                                {doc.findings.map((f: Doc) => (
                                                    <p key={f.code} className={f.status === 'failed' ? 'bad' : ''}>
                                                        <b>
                                                            {f.status === 'failed' ? '!' : '✓'} {f.code}
                                                        </b>
                                                        {f.message}
                                                    </p>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                    <AssetBrowser data={data} profile={profile} />
                                </>
                            )}
                            {stepId === 'attest' && (
                                <>
                                    <section className='v-attestation-sheet'>
                                        <p>DEMO PROGRAMME AUTHORITY</p>
                                        <div className='v-certificate-seal'>✓</div>
                                        <h2>
                                            Attestation of an
                                            <br />
                                            assured claim
                                        </h2>
                                        <span>{data.subject.name} · Thanjavur, Tamil Nadu</span>
                                        <strong>
                                            {data.current.report?.document.statement.object.value?.toFixed(2) || '—'}
                                            <small>tCO₂e · illustrative</small>
                                        </strong>
                                        <p>
                                            Bind the exact claim, accepted independent verification, subject and methodology. The qualifications remain part of
                                            the endorsement.
                                        </p>
                                        <div className='v-certificate-refs'>
                                            <span>
                                                Claim <code>{short(data.current.report?.id)}</code>
                                            </span>
                                            <span>
                                                Verification <code>{short(data.current.verify?.id)}</code>
                                            </span>
                                            {doc && (
                                                <span>
                                                    Attestation{' '}
                                                    <code>
                                                        {short(doc.id)} / v{doc.version}
                                                    </code>
                                                </span>
                                            )}
                                        </div>
                                        <p className='v-small'>
                                            An educational endorsement by a fictional authority. This is not a Gold Standard certificate or carbon credit.
                                        </p>
                                    </section>
                                    <AssetBrowser data={data} profile={profile} />
                                </>
                            )}
                            {stepId !== 'consent' && canAct && (
                                <section className='v-signing-panel'>
                                    <div>
                                        <p className='eyebrow'>YOUR SIGNATURE / {role.name.toUpperCase()}</p>
                                        <h2>{data.project.correction ? 'Create a corrected revision.' : 'Ready for the handoff?'}</h2>
                                        <p>
                                            {data.project.correction
                                                ? 'The earlier signed object stays in history. This submission will link back to it.'
                                                : 'Review the signed request before sending it. The receiving service returns its result through a separate callback.'}
                                        </p>
                                    </div>
                                    <details key={stepId} open={fudge} onToggle={(e) => setFudge(e.currentTarget.open)} className='v-fudge'>
                                        <summary>
                                            Try changing earlier data before signing <span>optional</span>
                                        </summary>
                                        <p>
                                            Change a protected value while keeping its original proof. The outer request can still be signed; the inner object’s
                                            signature or asset hash should fail.
                                        </p>
                                        <select aria-label='Earlier object to change' value={target} onChange={(e) => chooseTarget(e.target.value)}>
                                            <option value=''>Choose an earlier signed object or asset</option>
                                            {prior.map(([id, r]) => (
                                                <option key={id} value={id}>
                                                    {id} · {(r as Doc).kind}
                                                </option>
                                            ))}
                                            {data.assets.map((a: Doc) => (
                                                <option key={a.id} value={'asset:' + a.id}>
                                                    Asset · {a.name}
                                                </option>
                                            ))}
                                        </select>
                                        {target && (
                                            <textarea
                                                aria-label='Alter earlier object'
                                                spellCheck={false}
                                                value={edit}
                                                onChange={(e) => {
                                                    setEdit(e.target.value);
                                                    setPrepared(null);
                                                }}
                                            />
                                        )}
                                    </details>
                                    <div className='v-sign-actions'>
                                        <button className='v-button' disabled={busy} onClick={prepare}>
                                            {busy ? 'Preparing…' : 'Review & sign /' + stepId} →
                                        </button>
                                        {prepared && (
                                            <button className='v-button send' disabled={busy} onClick={send}>
                                                Send POST {prepared.endpoint} →
                                            </button>
                                        )}
                                    </div>
                                    {prepared && (
                                        <p className='v-small'>
                                            The signed request is visible in the API console. Sending it creates a persisted protocol request and a durable
                                            processing job.
                                        </p>
                                    )}
                                </section>
                            )}
                            {pending && (
                                <div className='v-pending'>
                                    <span className='v-spinner' />
                                    <div>
                                        <b>Waiting for the callback.</b>
                                        <p>The request is recorded in Postgres. Processing and callback delivery continue in the durable worker.</p>
                                        <button
                                            onClick={() =>
                                                task(async () => {
                                                    await call('/api/projects/' + projectId + '/retry-callback', {});
                                                    setNotice('Callback retry queued with the same signed bytes and message ID.');
                                                })
                                            }
                                        >
                                            Retry pending callback delivery
                                        </button>
                                    </div>
                                </div>
                            )}
                            {notice && (
                                <div className={notice.startsWith('HTTP 202') && delivered && failed ? 'v-error' : 'v-notice'} role={delivered && failed ? 'alert' : 'status'}>
                                    {notice.startsWith('HTTP 202') && delivered
                                        ? failed
                                            ? 'Callback received. Your /' + stepId + ' request failed. Review the reason above and create a corrected revision.'
                                            : 'Callback received and acknowledged. The signed result is saved in Postgres.'
                                        : notice}
                                </div>
                            )}
                            {completed && !pending && (
                                <section className='v-step-complete'>
                                    <div>
                                        <Pill>STEP RECORDED</Pill>
                                        <h3>{stepId === 'attest' ? 'The assurance chain is complete.' : step.next}</h3>
                                        <p>
                                            {stepId === 'consent'
                                                ? 'Your signed permission is saved.'
                                                : `The /on_${stepId} callback was received and acknowledged.`}
                                        </p>
                                    </div>
                                    {data.project.next_action === 'complete' ? (
                                        <Link className='v-button' href={'/projects/' + projectId + '?profile=' + profile}>
                                            Open project archive →
                                        </Link>
                                    ) : (
                                        <button className='v-button' onClick={goNext}>
                                            Continue to {roles.find((r) => r.id === roleForStep(data.project.next_action))?.name} →
                                        </button>
                                    )}
                                </section>
                            )}
                            {!canAct && !pending && !completed && data.project.next_action !== stepId && (
                                <button className='v-button' onClick={goNext}>
                                    Go to the current step: {data.project.next_action} →
                                </button>
                            )}
                        </div>
                    </div>
                    <ProtocolConsole data={data} selectedStep={stepId} prepared={prepared} />
                </div>
            </main>
        </div>
    );
}

function ProtocolConsole({ data, selectedStep: initialStep, prepared }: { data: Doc; selectedStep: string; prepared?: Doc | null }) {
    const [selectedStep, setSelectedStep] = useState(initialStep);
    useEffect(() => setSelectedStep(initialStep), [initialStep]);
    const [view, setView] = useState('request'),
        [exchangeId, setExchangeId] = useState('');
    useEffect(() => {
        if (prepared) setView('request');
    }, [prepared]);
    const requests = data.messages.filter((m: Doc) => m.direction === 'request' && m.action === selectedStep);
    const req = requests[0],
        cb = req ? data.messages.find((m: Doc) => m.correlation_id === req.message_id) : null,
        delivery = cb ? data.deliveries.find((d: Doc) => d.message_id === cb.message_id) : null;
    const exchange = data.exchanges.find((x: Doc) => x.id === exchangeId) || data.exchanges[0];
    const consentMode = selectedStep === 'consent';
    const consentValue =
        view === 'request'
            ? { method: 'POST', endpoint: '/api/projects/' + data.project.id + '/consent', body: {} }
            : view === 'ack'
            ? data.current.consent
                ? { httpStatus: 201, body: data.current.consent.document }
                : null
            : { message: 'Authorisation is a synchronous application operation. Protocol callbacks begin with /register.' };
    const value =
        view === 'request'
            ? prepared?.envelope || req?.envelope
            : view === 'ack'
            ? req?.acknowledgement
            : view === 'callback'
            ? cb?.envelope
            : view === 'callback-ack'
            ? delivery
                ? {
                      httpStatus: delivery.last_http_status,
                      response: delivery.last_response,
                      status: delivery.status,
                      attempts: delivery.attempts,
                      url: delivery.callback_url,
                      lastError: delivery.last_error,
                  }
                : null
            : view === 'assets'
            ? exchange
            : requests.map((m: Doc) => ({ messageId: m.message_id, status: m.status, outcome: m.business_outcome, at: m.received_at }));
    return (
        <aside className='v-protocol-console'>
            <div className='v-console-title'>
                <span className='v-dot' /> LIVE PROTOCOL CONSOLE <Pill tone='neutral'>POSTGRES</Pill>
            </div>
            <select aria-label='Protocol action' value={selectedStep} onChange={(e) => setSelectedStep(e.target.value)}>
                {journeySteps.map((s) => (
                    <option key={s.id} value={s.id}>
                        {s.label} · {s.id === 'consent' ? 'authorisation' : '/' + s.id}
                    </option>
                ))}
            </select>
            <div className='v-api-lifecycle'>
                <span className={req ? 'occurred' : ''}>1 Request</span>
                <b>→</b>
                <span className={req ? 'occurred' : ''}>2 ACK</span>
                <b>→</b>
                <span className={cb ? 'occurred' : ''}>3 Callback</span>
            </div>
            <div className='v-console-endpoint'>
                <b>
                    {consentMode
                        ? 'POST /api/projects/' + data.project.id + '/consent'
                        : view === 'callback' || view === 'callback-ack'
                        ? 'POST /on_' + selectedStep
                        : view === 'assets'
                        ? exchange?.method + ' ' + exchange?.endpoint
                        : consentMode
                        ? 'POST /api/projects/' + data.project.id + '/consent'
                        : 'POST /' + selectedStep}
                </b>
                <span>
                    {view === 'ack'
                        ? consentMode && data.current.consent
                            ? '201 Created'
                            : req
                            ? '202 Accepted'
                            : 'Pending'
                        : view === 'callback-ack'
                        ? delivery?.last_http_status || 'Pending'
                        : cb
                        ? cb.business_outcome
                        : 'Signed JSON'}
                </span>
            </div>
            <div className='v-console-tabs'>
                {[
                    ['request', 'Request'],
                    ['ack', 'Response ACK'],
                    ['callback', 'Callback'],
                    ['callback-ack', 'Callback ACK'],
                    ['assets', 'Asset APIs'],
                    ['history', 'Attempts'],
                ].map(([id, title]) => (
                    <button className={view === id ? 'active' : ''} key={id} onClick={() => setView(id)}>
                        {title}
                    </button>
                ))}
            </div>
            {view === 'assets' && (
                <select aria-label='Asset API exchange' value={exchangeId || exchange?.id || ''} onChange={(e) => setExchangeId(e.target.value)}>
                    {data.exchanges.map((x: Doc) => (
                        <option key={x.id} value={x.id}>
                            {x.method} {x.endpoint} · {x.http_status}
                        </option>
                    ))}
                </select>
            )}
            <Json value={consentMode && !prepared && view !== 'assets' ? consentValue : value} />
            <div className='v-console-explainer'>
                {view === 'request'
                    ? 'The sender signs context + message. Inner resources keep their own separate proofs.'
                    : view === 'ack'
                    ? 'An ACK means accepted for processing. It does not mean the MRV action succeeded.'
                    : view === 'callback'
                    ? 'The receiver posts this signed result to /on_*. Its correlationId identifies the original request.'
                    : view === 'callback-ack'
                    ? 'This is the actual callback delivery URL, HTTP response and retry count.'
                    : view === 'assets'
                    ? 'These catalog, signed access-grant and asset-retrieval exchanges are real HTTP calls, persisted in Postgres.'
                    : 'Every attempt is retained. A correction produces a new request ID and a new signed resource version.'}
            </div>
        </aside>
    );
}

function AssetBrowser({ data, profile, showHistory = false }: { data: Doc; profile: RoleId; showHistory?: boolean }) {
    const [preview, setPreview] = useState<Doc | null>(null),
        [error, setError] = useState(''),
        [busy, setBusy] = useState(false);
    async function load(asset: Doc) {
        setBusy(true);
        setError('');
        try {
            await enter(profile);
            setPreview(await call('/api/projects/' + data.project.id + '/asset', { assetId: asset.id }));
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }
    const registered = showHistory ? data.assets : data.assets.filter((a: Doc) => Object.values(data.current).some((r: any) => r.id === a.manifest_id));
    return (
        <section className='v-card v-asset-browser'>
            <div className='v-card-head'>
                <div>
                    <p className='eyebrow'>RETRIEVE FROM THE CUSTODIAN</p>
                    <h2>Evidence & methodology</h2>
                </div>
                <Pill tone='neutral'>AssetReferences</Pill>
            </div>
            <p>Open an asset to follow its catalog entry, signed access grant and verified file bytes. The API console records the exchange.</p>
            <ErrorBox message={error} />
            <div className='v-asset-list'>
                {registered.map((a: Doc) => (
                    <button disabled={busy} key={a.id} onClick={() => load(a)}>
                        <span>{a.media_type === 'text/csv' ? 'CSV' : a.name.includes('methodology') ? 'METHOD' : 'JSON'}</span>
                        <div>
                            <b>
                                {a.name}
                                {showHistory && (
                                    <span className='asset-version'>
                                        {' '}
                                        · {data.resources.find((r: Doc) => r.id === a.manifest_id)?.kind} v
                                        {data.resources.find((r: Doc) => r.id === a.manifest_id)?.version}
                                    </span>
                                )}
                            </b>
                            <small>
                                {short(a.digest)} · {a.size_bytes} bytes
                            </small>
                        </div>
                        <strong>Retrieve ↗</strong>
                    </button>
                ))}
            </div>
            {preview && (
                <div className='v-source-preview'>
                    <Pill>HASH VERIFIED</Pill>
                    <pre>{preview.content}</pre>
                </div>
            )}
        </section>
    );
}

export function ProjectArchive({ projectId, initialProfile = 'implementer' }: { projectId: string; initialProfile?: RoleId }) {
    const router = useRouter(),
        [tab, setTab] = useState('overview'),
        [version, setVersion] = useState(''),
        [profile, setProfile] = useState<RoleId>(initialProfile),
        [reason, setReason] = useState('Updated monitoring evidence and renewed assurance.'),
        [revisionStep, setRevisionStep] = useState<Action>('monitor'),
        [busy, setBusy] = useState(false);
    const { data, error, setError, refresh } = useProject(projectId, profile);
    const selected = data?.resources.find((r: Doc) => r.id === version) || data?.resources[0];
    async function revise() {
        setBusy(true);
        try {
            await enter(actionRole[revisionStep]);
            await call('/api/projects/' + projectId + '/revise', { action: revisionStep, reason });
            router.push('/projects/' + projectId + '/journey');
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }
    if (!data)
        return (
            <>
                <Topbar />
                <main id='main' className='v-page'>
                    <ErrorBox message={error} />
                    <p>Loading project history from Postgres…</p>
                </main>
            </>
        );
    const attestations = data.resources.filter((r: Doc) => r.action === 'attest');
    return (
        <>
            <Topbar profile={profile} />
            <main id='main' className='v-page'>
                <Link href='/projects' className='v-back'>
                    ← All projects
                </Link>
                <div className='v-page-title v-archive-title'>
                    <div>
                        <p className='eyebrow'>PROJECT ARCHIVE / BROWSE MODE</p>
                        <h1>{data.project.name}</h1>
                        <p>
                            {data.subject.name} · {Number(data.subject.area_ha).toFixed(2)} ha · Created {stamp(data.project.created_at)}
                        </p>
                    </div>
                    <Link href={'/projects/' + projectId + '/journey'} className='v-button'>
                        {data.project.next_action === 'complete' ? 'Review the journey' : 'Resume guided journey'} →
                    </Link>
                </div>
                <ErrorBox message={error} />
                <nav className='v-archive-tabs'>
                    {['overview', 'attestations', 'versions', 'protocol', 'ontologies'].map((t) => (
                        <button className={tab === t ? 'active' : ''} key={t} onClick={() => setTab(t)}>
                            {t === 'attestations' ? 'Attestations (' + attestations.length + ')' : t}
                        </button>
                    ))}
                    <select aria-label='Browse as profile' value={profile} onChange={(e) => setProfile(e.target.value as RoleId)}>
                        {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.name}
                            </option>
                        ))}
                    </select>
                </nav>
                {tab === 'overview' && (
                    <>
                        <div className='v-archive-overview'>
                            <FieldMap selected={data.project.parcel_id} />
                            <div>
                                <section className='v-card'>
                                    <Pill tone={data.project.correction ? 'amber' : 'green'}>
                                        {data.project.next_action === 'complete'
                                            ? 'Attested'
                                            : data.project.correction
                                            ? 'Correction required'
                                            : 'Next: ' + data.project.next_action}
                                    </Pill>
                                    <h2>One project. A complete history.</h2>
                                    <dl className='v-summary-list'>
                                        <div>
                                            <dt>Signed resource versions</dt>
                                            <dd>{data.resources.length}</dd>
                                        </div>
                                        <div>
                                            <dt>Protocol messages</dt>
                                            <dd>{data.messages.length}</dd>
                                        </div>
                                        <div>
                                            <dt>Source assets</dt>
                                            <dd>{data.assets.length}</dd>
                                        </div>
                                        <div>
                                            <dt>Attestation versions</dt>
                                            <dd>{attestations.length}</dd>
                                        </div>
                                    </dl>
                                </section>
                                <section className='v-card'>
                                    <h2>Start a new revision</h2>
                                    <p>Choose the step to correct. Earlier signed versions remain in this archive. Later assurance must be renewed.</p>
                                    <select
                                        aria-label='Revision starting step'
                                        value={revisionStep}
                                        onChange={(e) => setRevisionStep(e.target.value as Action)}
                                    >
                                        {journeySteps
                                            .filter((s) => s.id !== 'consent')
                                            .map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.label}
                                                </option>
                                            ))}
                                    </select>
                                    <label className='v-label'>
                                        Revision reason
                                        <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
                                    </label>
                                    <button
                                        disabled={busy || reason.trim().length < 5 || !!data.project.pending_message_id}
                                        className='v-button'
                                        onClick={revise}
                                    >
                                        Create a revision journey →
                                    </button>
                                </section>
                            </div>
                        </div>
                        <AssetBrowser data={data} profile={profile} showHistory />
                    </>
                )}
                {tab === 'attestations' && (
                    <div className='v-attestation-archive'>
                        {attestations.length ? (
                            attestations.map((a: Doc) => (
                                <section key={a.id} className='v-card v-archived-certificate'>
                                    <Pill tone={a.status === 'active' ? 'green' : 'neutral'}>
                                        {a.status} · version {a.version}
                                    </Pill>
                                    <h2>Attestation v{a.version}</h2>
                                    <p>{stamp(a.created_at)} · Demo Programme Authority</p>
                                    <p>{a.document.scope}</p>
                                    <dl>
                                        <div>
                                            <dt>Claim</dt>
                                            <dd>{short(a.document.claim.id)}</dd>
                                        </div>
                                        <div>
                                            <dt>Revision of</dt>
                                            <dd>{a.revision_of ? short(a.revision_of) : 'Initial version'}</dd>
                                        </div>
                                    </dl>
                                    <button
                                        className='v-link-button'
                                        onClick={() => {
                                            setVersion(a.id);
                                            setTab('versions');
                                        }}
                                    >
                                        Inspect signed document →
                                    </button>
                                </section>
                            ))
                        ) : (
                            <div className='v-empty'>
                                <h3>No attestation yet.</h3>
                                <p>Complete verification and attestation in the guided journey.</p>
                            </div>
                        )}
                    </div>
                )}
                {tab === 'versions' && (
                    <div className='v-version-browser'>
                        <div className='v-version-list'>
                            {data.resources.map((r: Doc) => (
                                <button key={r.id} className={selected?.id === r.id ? 'active' : ''} onClick={() => setVersion(r.id)}>
                                    <b>
                                        {r.kind} <span>v{r.version}</span>
                                    </b>
                                    <small>
                                        {r.status} · {stamp(r.created_at)}
                                    </small>
                                </button>
                            ))}
                        </div>
                        <section className='v-card'>
                            <div className='v-card-head'>
                                <h2>
                                    {selected?.kind} / v{selected?.version}
                                </h2>
                                <Pill tone='neutral'>{selected?.status}</Pill>
                            </div>
                            <p className='v-small'>Digest: {selected?.digest}</p>
                            {selected?.revision_of && (
                                <p className='v-small'>
                                    Revision of {selected.revision_of} · {selected.revision_reason}
                                </p>
                            )}
                            <Json value={selected?.document} />
                        </section>
                    </div>
                )}
                {tab === 'protocol' && (
                    <ProtocolConsole
                        data={data}
                        selectedStep={
                            data.project.next_action === 'complete' ? 'attest' : data.project.next_action === 'consent' ? 'register' : data.project.next_action
                        }
                    />
                )}
                {tab === 'ontologies' && <OntologyView />}
            </main>
            <Footer />
        </>
    );
}
function OntologyView() {
    return (
        <section className='v-card'>
            <div className='v-card-head'>
                <div>
                    <p className='eyebrow'>EXACT TERMS USED IN THE CLAIM</p>
                    <h2>AgrO · ENVO · RESEO</h2>
                </div>
                <Pill tone='neutral'>JSON-LD 1.1</Pill>
            </div>
            <div className='v-table-wrap'>
                <table>
                    <thead>
                        <tr>
                            <th>Ontology / term</th>
                            <th>IRI</th>
                            <th>Claim path</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ontologyTerms.map((t) => (
                            <tr key={t.iri}>
                                <td>
                                    <b>{t.ontology}</b>
                                    <small>
                                        {t.term} · {t.release}
                                    </small>
                                </td>
                                <td>
                                    <a href={t.iri} target='_blank' rel='noreferrer'>
                                        {t.iri} ↗
                                    </a>
                                </td>
                                <td>
                                    <code>{t.path}</code>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className='v-small'>
                AgrO types the agricultural equipment. ENVO types the sampled environmental material. RESEO types the satellite product and source relationship.
                Protocol and carbon-calculation fields use the explicit dMRV demo vocabulary. Full OWL reasoning is not performed.
            </p>
        </section>
    );
}
