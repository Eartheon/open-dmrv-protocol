import { randomBytes } from 'node:crypto';
import { pool, initialize, transaction } from './db.ts';
import { origin, serviceCredential, tokenHash } from './config.ts';
import { roles, party, agent, actionRole } from '../lib/model.ts';
import type { Doc, RoleId, Action } from '../lib/model.ts';
import { isAction, isProfile, fail, ProtocolError, ack, uid, sign, verifySigned, timestamp } from './protocol.ts';
import { projectFor, createProject, authorise, projectSnapshot, audit } from './repository.ts';
import { prepareRequest, acceptRequest, acceptCallback } from './workflow.ts';
import { readAndCheckAsset, logExchange, retrieveAsset } from './assets.ts';

async function authenticate(request: Request): Promise<RoleId> {
    if (request.headers.get('authorization') === 'Bearer ' + serviceCredential()) {
        const profile = request.headers.get('x-dmrv-profile') || '';
        if (!isProfile(profile)) fail('UNAUTHENTICATED', 'A registered acting profile is required.', 401, 'register');
        return profile as RoleId;
    }
    const cookie = request.headers.get('cookie')?.match(/(?:^|;\s*)dmrv_session=([^;]+)/)?.[1];
    if (!cookie) fail('UNAUTHENTICATED', 'Choose a demonstration profile to open this application.', 401, 'register');
    const session = (await pool().query('SELECT profile_id FROM dmrv.sessions WHERE token_hash=$1 AND expires_at>now()', [tokenHash(cookie!)])).rows[0];
    if (!session || !isProfile(session.profile_id)) fail('UNAUTHENTICATED', 'Your demo session has expired. Choose the profile again.', 401, 'register');
    return session.profile_id;
}
export async function handle(request: Request) {
    const url = new URL(request.url),
        path = url.pathname;
    let profile: RoleId | undefined,
        body: Doc = {},
        exchangeProject: string | undefined;
    const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
        Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
    try {
        const requestOrigin = request.headers.get('origin');
        if (requestOrigin && ![origin, origin.replace('localhost', '127.0.0.1'), origin.replace('127.0.0.1', 'localhost')].includes(requestOrigin))
            fail('ORIGIN_DENIED', 'This request origin is not registered.', 403, 'register');
        if (request.method === 'POST') {
            if (Number(request.headers.get('content-length') || 0) > 1024 * 1024) fail('PAYLOAD_TOO_LARGE', 'Maximum request size is 1 MiB.', 413, 'register');
            const raw = await request.text();
            if (Buffer.byteLength(raw) > 1024 * 1024) fail('PAYLOAD_TOO_LARGE', 'Maximum request size is 1 MiB.', 413, 'register');
            try {
                body = raw ? JSON.parse(raw) : {};
                if (!body || Array.isArray(body) || typeof body !== 'object') throw Error();
            } catch {
                fail('INVALID_JSON', 'The request must be a JSON object.', 400, 'register');
            }
        }
        await initialize();
        if (path === '/api/health') return json({ status: 'ok', database: 'connected', storage: 'Postgres', callbackOrigin: origin, protocol: '0.0.1' });
        if (path === '/api/session' && request.method === 'POST') {
            if (!isProfile(body.profile)) fail('UNKNOWN_PROFILE', 'Choose a known demonstration profile.', 400, 'register');
            if (process.env.DEMO_AUTH_ENABLED === 'false')
                fail('DEMO_AUTH_DISABLED', 'Demo role selection is disabled. Connect an identity provider for deployment.', 403, 'register');
            const token = randomBytes(32).toString('base64url');
            await pool().query("INSERT INTO dmrv.sessions(token_hash,party_id,profile_id,expires_at) VALUES($1,$2,$3,now()+interval '4 hours')", [
                tokenHash(token),
                party(body.profile),
                body.profile,
            ]);
            return json({ profile: body.profile, partyId: party(body.profile), authentication: 'Demo role session' }, 201, {
                'Set-Cookie': `dmrv_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=14400${origin.startsWith('https:') ? '; Secure' : ''}`,
            });
        }
        if (path.startsWith('/on_')) {
            if (request.headers.get('authorization') !== 'Bearer ' + serviceCredential())
                fail('UNAUTHENTICATED', 'A callback service credential is required.', 401, 'register');
            const action = path.slice(4);
            if (!isAction(action) || request.method !== 'POST') fail('UNKNOWN_ACTION', 'Unknown callback.', 404, 'register');
            return json(await acceptCallback(action as Action, body));
        }
        profile = await authenticate(request);
        if (path === '/api/session' && request.method === 'GET') return json({ profile, partyId: party(profile) });
        if (isAction(path.slice(1)) && request.method === 'POST') {
            if (!request.headers.get('content-type')?.includes('application/vnd.open-dmrv+json'))
                fail('UNSUPPORTED_MEDIA_TYPE', 'Use application/vnd.open-dmrv+json;version=0.0.1.', 415, 'register');
            return json(await acceptRequest(path.slice(1) as Action, profile, body, request.headers.get('idempotency-key') || undefined), 202);
        }
        if (path === '/api/projects' && request.method === 'GET') {
            const result = await pool().query(
                "SELECT p.*,s.name AS subject_name,s.area_ha,(SELECT count(*)::int FROM dmrv.resources r WHERE r.project_id=p.id AND r.action='attest') AS attestation_revisions FROM dmrv.projects p JOIN dmrv.project_members m ON m.project_id=p.id JOIN dmrv.subjects s ON s.project_id=p.id WHERE m.party_id=$1 ORDER BY p.updated_at DESC",
                [party(profile)]
            );
            return json({ projects: result.rows, profile });
        }
        if (path === '/api/projects' && request.method === 'POST') {
            if (body.domain && body.domain !== 'carbon') fail('DOMAIN_NOT_AVAILABLE', 'Digital Twins is coming soon.', 400, 'register');
            return json(await createProject(body.name, body.parcelId, profile), 201);
        }
        const projectRoute = path.match(/^\/api\/projects\/([0-9a-f-]{36})(?:\/(consent|sign|revise|retry-callback|asset))?$/);
        if (projectRoute) {
            const projectId = projectRoute[1],
                operation = projectRoute[2];
            await projectFor(projectId, profile);
            if (!operation && request.method === 'GET') return json(await projectSnapshot(projectId, profile));
            if (operation === 'asset' && request.method === 'POST') {
                const asset = (await pool().query('SELECT * FROM dmrv.assets WHERE id=$1 AND project_id=$2', [body.assetId, projectId])).rows[0];
                if (!asset) fail('EVIDENCE_UNAVAILABLE', 'Unknown project asset.', 404, 'monitor');
                return json({ assetId: asset.id, name: asset.name, content: await retrieveAsset(asset.descriptor, profile, projectId), digest: asset.digest });
            }
            if (operation === 'consent' && request.method === 'POST') return json(await authorise(projectId, profile), 201);
            if (operation === 'sign' && request.method === 'POST') {
                if (!isAction(body.action)) fail('UNKNOWN_ACTION', 'Unknown signing action.', 400, 'register');
                return json(await prepareRequest(projectId, profile, body.action, body.values || {}, body.overrides || {}));
            }
            if (operation === 'revise' && request.method === 'POST') {
                if (!isAction(body.action) || actionRole[body.action] !== profile)
                    fail('ROLE_NOT_AUTHORISED', 'Only the responsible profile can begin this revision.', 403, 'register');
                if (typeof body.reason !== 'string' || body.reason.trim().length < 5)
                    fail('REVISION_REASON_REQUIRED', 'Explain why this revision is needed.', 400, body.action);
                await transaction(async (db) => {
                    const p = await projectFor(projectId, profile!, db, true);
                    if (p.pending_message_id) fail('BUSY', 'Wait for the outstanding callback.', 409, p.next_action);
                    await db.query('UPDATE dmrv.projects SET next_action=$2,correction=$3,revision=revision+1,updated_at=now() WHERE id=$1', [
                        projectId,
                        body.action,
                        { code: 'REVISION_REQUESTED', message: body.reason.slice(0, 500), retryFrom: body.action },
                    ]);
                    await audit(db, projectId, profile!, 'revision_requested', { action: body.action, reason: body.reason });
                });
                return json({ started: true });
            }
            if (operation === 'retry-callback' && request.method === 'POST') {
                await pool().query(
                    "UPDATE dmrv.outbox o SET status='pending',available_at=now(),locked_until=NULL,attempts=0 WHERE o.kind='callback' AND o.message_id IN (SELECT m.message_id FROM dmrv.messages m WHERE m.project_id=$1 AND m.status<>'delivered')",
                    [projectId]
                );
                return json({ queued: true });
            }
        }
        if (path === '/api/registry') {
            const result = await pool().query(
                'SELECT p.*,a.id AS agent_id,k.id AS verification_method,k.public_key_jwk,k.valid_from,k.valid_until,k.revoked_at FROM dmrv.parties p JOIN dmrv.agents a ON a.party_id=p.id JOIN dmrv.verification_methods k ON k.agent_id=a.id ORDER BY p.profile_id'
            );
            return json({ parties: result.rows });
        }
        if (path.startsWith('/api/status/')) {
            const resourceId = decodeURIComponent(path.slice('/api/status/'.length));
            const r = (await pool().query('SELECT * FROM dmrv.resources WHERE id=$1', [resourceId])).rows[0];
            if (!r) fail('NOT_FOUND', 'Unknown resource.', 404, 'register');
            await projectFor(r.project_id, profile);
            const events = (await pool().query('SELECT * FROM dmrv.resource_status_events WHERE resource_id=$1 ORDER BY created_at', [r.id])).rows;
            return json(
                sign(
                    { id: uid(), type: 'StatusRecord', objectId: r.id, status: r.status, events, asOf: timestamp(), statusIssuer: party('registrar') },
                    'registrar'
                )
            );
        }
        const catalogMatch = path.match(/^\/catalog\/(resources|assets)\/(.+)$/);
        if (catalogMatch && request.method === 'GET') {
            const id = decodeURIComponent(catalogMatch[2]);
            const row = (
                await pool().query(catalogMatch[1] === 'resources' ? 'SELECT * FROM dmrv.resources WHERE id=$1' : 'SELECT * FROM dmrv.assets WHERE id=$1', [id])
            ).rows[0];
            if (!row) fail('RESOURCE_UNAVAILABLE', 'The custodian has no resource with this ID.', 404, 'monitor');
            await projectFor(row.project_id, profile);
            exchangeProject = row.project_id;
            const result = catalogMatch[1] === 'resources' ? { document: row.document, digest: row.digest, status: row.status } : row.descriptor;
            await logExchange(row.project_id, profile, 'GET', path, null, result, 200);
            return json(result);
        }
        if (path === '/evidence/access-grants' && request.method === 'POST') {
            await verifySigned(body, profile, 'authentication', body.id);
            const asset = (await pool().query('SELECT * FROM dmrv.assets WHERE id=$1', [body.resourceId])).rows[0];
            if (!asset) fail('EVIDENCE_UNAVAILABLE', 'No evidence asset is registered with this ID.', 404, 'monitor');
            await projectFor(asset.project_id, profile);
            exchangeProject = asset.project_id;
            if (
                body.projectId !== asset.project_id ||
                body.requester?.partyId !== party(profile) ||
                body.requester?.agentId !== agent(profile) ||
                body.purpose !== 'mrv-' + profile ||
                JSON.stringify(body.requestedScopes) !== '["read"]'
            )
                fail('ACCESS_DENIED', 'The access request does not match the resource, actor or permitted read purpose.', 403, 'register');
            const custody = asset.custodian.split('/').pop() as RoleId;
            const grant = sign(
                {
                    id: uid(),
                    type: 'AccessGrant',
                    resourceId: asset.id,
                    subject: agent(profile),
                    requestingParty: party(profile),
                    purpose: body.purpose,
                    href: origin + '/evidence/assets/' + encodeURIComponent(asset.id),
                    method: 'GET',
                    expiresAt: new Date(Date.now() + 120000).toISOString(),
                    grantedScopes: ['read'],
                    expectedDigest: asset.digest,
                    constraints: { redistribution: false },
                    issuedAt: timestamp(),
                },
                custody
            );
            await transaction(async (db) => {
                await db.query(
                    'INSERT INTO dmrv.access_requests(id,project_id,requester,resource_id,purpose,request,response,status) VALUES($1,$2,$3,$4,$5,$6,$7,201)',
                    [body.id, asset.project_id, party(profile!), asset.id, body.purpose, body, grant]
                );
                await db.query('INSERT INTO dmrv.access_grants(id,project_id,asset_id,requester,purpose,expires_at,document) VALUES($1,$2,$3,$4,$5,$6,$7)', [
                    grant.id,
                    asset.project_id,
                    asset.id,
                    party(profile!),
                    body.purpose,
                    grant.expiresAt,
                    grant,
                ]);
            });
            await logExchange(asset.project_id, profile, 'POST', path, body, grant, 201);
            return json(grant, 201);
        }
        const fileMatch = path.match(/^\/evidence\/assets\/(.+)$/);
        if (fileMatch && request.method === 'GET') {
            const asset = (await pool().query('SELECT * FROM dmrv.assets WHERE id=$1', [decodeURIComponent(fileMatch[1])])).rows[0];
            if (!asset) fail('EVIDENCE_UNAVAILABLE', 'The evidence asset is unavailable.', 404, 'monitor');
            await projectFor(asset.project_id, profile);
            exchangeProject = asset.project_id;
            const g = (await pool().query('SELECT * FROM dmrv.access_grants WHERE id=$1', [url.searchParams.get('grantId') || ''])).rows[0];
            if (!g || g.asset_id !== asset.id || g.requester !== party(profile) || g.purpose !== 'mrv-' + profile || g.revoked_at)
                fail('ACCESS_DENIED', 'The grant is not valid for this actor, asset and purpose.', 403, 'register');
            if (new Date(g.expires_at).getTime() <= Date.now())
                fail('ACCESS_GRANT_EXPIRED', 'Request a fresh evidence grant; this one has expired.', 403, 'verify');
            await verifySigned(g.document, asset.custodian.split('/').pop());
            const content = await readAndCheckAsset(asset);
            const result = { assetId: asset.id, mediaType: asset.media_type, digest: asset.digest, content };
            await logExchange(asset.project_id, profile, 'GET', path, { grantId: g.id }, result, 200);
            return json(result);
        }
        fail('NOT_FOUND', 'Unknown application or protocol endpoint.', 404, 'register');
    } catch (error) {
        const e = error as ProtocolError;
        const safe =
            e instanceof ProtocolError
                ? { code: e.code, message: e.message, retryFrom: e.retryFrom, pointer: e.pointer }
                : {
                      code: 'DATABASE_OR_SERVICE_UNAVAILABLE',
                      message: 'The database or local service is unavailable. Check DATABASE_URL, run pnpm db:migrate and start pnpm dev.',
                      retryFrom: 'register',
                  };
        if (exchangeProject && profile)
            try {
                await logExchange(exchangeProject, profile, request.method, path, body, safe, e.status || 503);
            } catch {}
        return json({ ...ack('NACK', safe), error: safe }, e.status || 503);
    }
}
