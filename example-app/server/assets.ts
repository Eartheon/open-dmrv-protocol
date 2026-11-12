import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { origin, serviceCredential } from './config.ts';
import { pool } from './db.ts';
import { uid, timestamp, sign, hash, digest, verifySigned, fail } from './protocol.ts';
import { party, agent } from '../lib/model.ts';
import type { Doc, RoleId } from '../lib/model.ts';

export function assetPath(relative: string) {
    const base = resolve('public/assets'),
        path = resolve('public', relative);
    if (!path.startsWith(base + sep)) fail('INVALID_ASSET_PATH', 'Asset storage path is outside the public evidence root.', 403, 'monitor');
    return path;
}
export function registeredPath(uri: string) {
    const url = new URL(uri, origin);
    if (url.origin !== origin || url.username || url.password)
        fail('UNREGISTERED_CUSTODIAN', 'The AssetReference points to an unregistered custodian origin.', 403, 'register');
    return url.pathname + url.search;
}
export function prepareAsset(projectId: string, name: string, mediaType: string, content: string, custodian: RoleId = 'measurement') {
    const assetId = uid(),
        folder = randomUUID(),
        relative = `assets/${projectId}/${folder}/${name}`,
        file = assetPath(relative);
    const bytes = Buffer.from(content, 'utf8');
    mkdirSync(dirname(file), { recursive: true });
    const temporary = file + '.tmp';
    writeFileSync(temporary, bytes, { flag: 'wx' });
    renameSync(temporary, file);
    const descriptor = sign(
        {
            id: assetId,
            type: 'AssetReference',
            name,
            mediaType,
            roles: ['data', 'evidence'],
            custodian: party(custodian),
            location: {
                catalogUri: origin + '/catalog/assets/' + encodeURIComponent(assetId),
                accessService: origin + '/evidence/access-grants',
                protocol: new URL(origin).protocol.replace(':', ''),
                method: 'POST',
                auth: 'capability-grant',
                publicDemoUri: origin + '/' + relative,
            },
            integrity: { algorithm: 'sha-256', digest: hash(bytes).toString('hex'), sizeBytes: bytes.length },
            license: 'Synthetic educational data; public demonstration access.',
            accessPolicy: 'urn:open-dmrv:policy:project-members-v1',
            createdAt: timestamp(),
        },
        custodian
    );
    return {
        id: assetId,
        projectId,
        name,
        mediaType,
        custodian: party(custodian),
        relativePath: relative,
        digest: 'sha256:' + descriptor.integrity.digest,
        sizeBytes: bytes.length,
        descriptor,
        descriptorDigest: digest(descriptor),
    };
}
export async function internalFetch(path: string, profile: RoleId, body?: Doc) {
    if (!path.startsWith('/') || path.startsWith('//'))
        fail('INVALID_ASSET_LOCATION', 'Only registered local custodian routes may be resolved.', 422, 'register');
    let response: Response | undefined;
    try {
        response = await fetch(origin + path, {
            method: body ? 'POST' : 'GET',
            headers: { Authorization: 'Bearer ' + serviceCredential(), 'X-DMRV-Profile': profile, ...(body ? { 'Content-Type': 'application/json' } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}),
            redirect: 'error',
            signal: AbortSignal.timeout(10000),
        });
    } catch {
        fail('EVIDENCE_UNAVAILABLE', 'The registered custodian could not be reached.', 422, 'monitor');
    }
    const text = await response!.text();
    let data: Doc;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }
    if (!response!.ok)
        fail(
            data.error?.code || 'EVIDENCE_UNAVAILABLE',
            data.error?.message || 'The registered custodian did not return the resource.',
            422,
            data.error?.retryFrom || 'monitor'
        );
    return data;
}
export async function retrieveResource(resourceId: string, profile: RoleId, expectedDigest?: string) {
    const response = await internalFetch('/catalog/resources/' + encodeURIComponent(resourceId), profile);
    if (expectedDigest && digest(response.document) !== expectedDigest)
        fail('REFERENCE_MISMATCH', 'The catalog object does not match its protected digest.', 422, 'report');
    return response.document;
}
export async function retrieveAsset(asset: Doc, profile: RoleId, projectId: string) {
    const descriptor = await internalFetch(registeredPath(asset.location.catalogUri), profile);
    const custody = (descriptor.custodian || '').split('/').pop() as RoleId;
    await verifySigned(descriptor, custody);
    if (digest(descriptor) !== digest(asset)) fail('REFERENCE_MISMATCH', 'AssetReference differs from the registered signed descriptor.', 422, 'monitor');
    const accessId = uid();
    const request = sign(
        {
            id: accessId,
            type: 'AccessRequest',
            projectId,
            resourceId: asset.id,
            requester: { partyId: party(profile), agentId: agent(profile) },
            purpose: 'mrv-' + profile,
            requestedScopes: ['read'],
            requestedExpirySeconds: 120,
            issuedAt: timestamp(),
        },
        profile,
        'authentication',
        accessId
    );
    const grant = await internalFetch(registeredPath(asset.location.accessService), profile, request);
    await verifySigned(grant, custody);
    if (grant.resourceId !== asset.id || grant.subject !== agent(profile) || grant.purpose !== 'mrv-' + profile || grant.method !== 'GET')
        fail('ACCESS_DENIED', 'The custodian issued a grant for a different asset, requester or purpose.', 403, 'register');
    if (Date.parse(grant.expiresAt) <= Date.now()) fail('ACCESS_GRANT_EXPIRED', 'The evidence grant expired before retrieval.', 403, 'verify');
    const href = registeredPath(grant.href);
    const response = await internalFetch(href + (href.includes('?') ? '&' : '?') + 'grantId=' + encodeURIComponent(grant.id), profile);
    const raw = response.content as string;
    if ('sha256:' + hash(raw).toString('hex') !== grant.expectedDigest || hash(raw).toString('hex') !== asset.integrity.digest)
        fail('DIGEST_MISMATCH', 'Retrieved asset bytes do not match the signed descriptor and evidence manifest.', 422, 'monitor');
    return raw;
}
export async function readAndCheckAsset(row: Doc) {
    let bytes: Buffer;
    try {
        bytes = readFileSync(assetPath(row.relative_path));
    } catch {
        fail('EVIDENCE_UNAVAILABLE', 'The registered evidence file is unavailable at its custodian.', 404, 'monitor');
    }
    if ('sha256:' + hash(bytes!).toString('hex') !== row.digest)
        fail(
            'DIGEST_MISMATCH',
            'Stored asset bytes have changed since the custodian signed them.',
            422,
            row.custodian.endsWith('/standards') ? 'register' : 'monitor'
        );
    return bytes!.toString('utf8');
}
export async function logExchange(
    projectId: string,
    profile: RoleId,
    method: string,
    endpoint: string,
    request: Doc | null,
    response: unknown,
    status: number
) {
    await pool().query('INSERT INTO dmrv.api_exchanges(id,project_id,requester,method,endpoint,request,response,http_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [
        randomUUID(),
        projectId,
        party(profile),
        method,
        endpoint,
        request,
        JSON.stringify(response),
        status,
    ]);
}
