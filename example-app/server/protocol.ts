import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { canonicalize, digest, hash, signObject, verifyObject } from './crypto.ts';
import { getKeys, origin } from './config.ts';
import { pool } from './db.ts';
import { roles, party, agent, actionRole } from '../lib/model.ts';
import type { Doc, RoleId, Action } from '../lib/model.ts';

export const uid = () => 'urn:uuid:' + randomUUID();
export const timestamp = () => new Date().toISOString();
export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
export class ProtocolError extends Error {
    code: string;
    status: number;
    retryFrom: string;
    pointer: string;
    constructor(code: string, message: string, status = 422, retryFrom = 'report', pointer = '/message') {
        super(message);
        this.code = code;
        this.status = status;
        this.retryFrom = retryFrom;
        this.pointer = pointer;
    }
}
export const fail = (code: string, message: string, status = 422, retryFrom = 'report', pointer = '/message'): never => {
    throw new ProtocolError(code, message, status, retryFrom, pointer);
};
export const isAction = (value: string): value is Action => ['register', 'monitor', 'report', 'verify', 'attest'].includes(value);
export const isProfile = (value: string): value is RoleId => roles.some((r) => r.id === value);
export function sign(document: Doc, profile: RoleId, purpose = 'assertionMethod', challenge?: string) {
    const k = getKeys()[profile];
    return signObject(document, k.privateKey, k.id, purpose, challenge);
}
export async function verifySigned(document: Doc, profile: RoleId, purpose = 'assertionMethod', challenge?: string, db?: PoolClient) {
    const p = document?.proof,
        role = roles.find((r) => r.id === profile)!;
    const rows = (await (db || pool()).query('SELECT * FROM dmrv.verification_methods WHERE id=$1', [p?.verificationMethod || ''])).rows;
    const key = rows[0];
    if (!key || key.party_id !== party(profile) || key.agent_id !== agent(profile) || key.role !== role.role)
        fail('UNTRUSTED_SIGNER', 'The key is not assigned to the accountable party and required role.', 422, 'register');
    const signedAt = Date.parse(p?.created);
    if (
        !Number.isFinite(signedAt) ||
        signedAt > Date.now() + 60000 ||
        signedAt < new Date(key.valid_from).getTime() ||
        signedAt > new Date(key.valid_until).getTime()
    )
        fail('EXPIRED_KEY', 'The signing key was not valid at the signing instant.', 422, 'register');
    if (key.revoked_at && signedAt >= new Date(key.revoked_at).getTime()) fail('REVOKED_KEY', 'This key was revoked before signing.', 422, 'register');
    if (
        p.proofPurpose !== purpose ||
        p.domain !== 'sandbox.open-dmrv.local' ||
        (challenge && p.challenge !== challenge) ||
        !verifyObject(document, key.public_key_pem)
    )
        fail('INVALID_SIGNATURE', 'The protected object or proof differs from the content its issuer signed.', 422, 'report');
    return true;
}
export function makeEnvelope(action: Action, profile: RoleId, project: Doc, message: Doc) {
    const messageId = uid();
    return sign(
        {
            context: {
                protocol: 'org.open-dmrv',
                version: '0.0.1',
                action,
                messageId,
                transactionId: project.transaction_id,
                timestamp: timestamp(),
                ttl: 'PT10M',
                sender: { partyId: party(profile), agentId: agent(profile) },
                receiver: { partyId: party(action === 'register' ? 'registrar' : actionRole[action]) },
                callbackUri: origin + '/on_' + action,
                domain: 'carbon:soil',
                projectId: project.id,
                projectRevision: project.revision,
            },
            message,
        },
        profile,
        'authentication',
        messageId
    );
}
export function validateEnvelopeShape(body: Doc, action: Action, profile: RoleId) {
    const c = body?.context;
    if (
        !c ||
        !/^urn:uuid:[0-9a-f-]{36}$/.test(c.messageId || '') ||
        c.protocol !== 'org.open-dmrv' ||
        c.version !== '0.0.1' ||
        c.action !== action ||
        !body.message ||
        typeof body.message !== 'object'
    )
        fail('INVALID_ENVELOPE', 'The request must contain context, message and a valid action envelope.', 400, 'register');
    if (
        c.sender?.partyId !== party(profile) ||
        c.sender?.agentId !== agent(profile) ||
        c.receiver?.partyId !== party(action === 'register' ? 'registrar' : actionRole[action]) ||
        c.callbackUri !== origin + '/on_' + action ||
        c.ttl !== 'PT10M'
    )
        fail('INVALID_ENVELOPE', 'The sender, receiver, callback or TTL does not match registration.', 400, 'register');
    if (actionRole[action] !== profile) fail('ROLE_NOT_AUTHORISED', 'This profile is not authorised for this action.', 403, 'register');
    if (!Number.isFinite(Date.parse(c.timestamp)) || Math.abs(Date.now() - Date.parse(c.timestamp)) > 600000)
        fail('MESSAGE_EXPIRED', 'This message is outside its ten-minute validity period.', 400, action);
}
export function ack(status: 'ACK' | 'NACK' = 'ACK', error: Doc | null = null) {
    return { ack: { status }, error };
}
export function reference(document: Doc) {
    return { id: document.id, digest: digest(document), catalogUri: origin + '/catalog/resources/' + encodeURIComponent(document.id) };
}
export function calculate(csv: string, area: number) {
    const lines = csv.trim().split(/\r?\n/);
    if (lines[0] !== 'sample,baselineSocPct,currentSocPct,bulkDensity,depthCm,rockFraction')
        fail('INVALID_EVIDENCE', 'The soil CSV header does not match the registered measurement schema.', 422, 'monitor');
    const rows = lines.slice(1).map((line) => line.split(',').slice(1).map(Number));
    if (rows.length < 3 || rows.some((r) => r.length !== 5 || r.some((v) => !Number.isFinite(v))))
        fail('QUALITY_INSUFFICIENT', 'At least three numeric paired samples are required in this teaching profile.', 422, 'monitor');
    if (rows.some(([b, c, d, z, r]) => b < 0 || b > 100 || c < 0 || c > 100 || d <= 0 || d > 3 || z <= 0 || z > 200 || r < 0 || r >= 1))
        fail('INVALID_EVIDENCE', 'A sample value is outside the demonstration profile bounds.', 422, 'monitor');
    const delta = rows.reduce((s, [b, c, d, z, r]) => s + (c - b) * d * z * (1 - r), 0) / rows.length;
    const gross = (delta * area * 44) / 12,
        emissions = area * 0.3,
        leakage = area * 0.1;
    return {
        areaHa: area,
        samples: rows.length,
        deltaTCPerHa: +delta.toFixed(6),
        grossTCO2e: +gross.toFixed(4),
        projectEmissionsTCO2e: +emissions.toFixed(4),
        leakageTCO2e: +leakage.toFixed(4),
        bufferFraction: 0.2,
        netTCO2e: +Math.max(0, (gross - emissions - leakage) * 0.8).toFixed(4),
        profile: 'urn:open-dmrv:demo:soil-stock:v1',
        formula: 'max(0, ((currentSOC% - baselineSOC%) × density × depth × (1 - rockFraction) × area × 44/12 - emissions - leakage) × (1 - buffer))',
    };
}
export { canonicalize, digest, hash };
