import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { keypair, hash } from './crypto.ts';
import { roles, party, agent } from '../lib/model.ts';
import type { Doc } from '../lib/model.ts';

// This module is imported only by Node route handlers, scripts and the worker.
if (existsSync(resolve('.env.local'))) process.loadEnvFile(resolve('.env.local'));
export const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
export const runtimeDir = resolve('runtime');
mkdirSync(runtimeDir, { recursive: true });
const keyPath = join(runtimeDir, 'keys.private.json');
export function getKeys(): Doc {
    if (!existsSync(keyPath)) {
        const keys = Object.fromEntries(
            roles.map((r) => [
                r.id,
                {
                    ...keypair(),
                    id: party(r.id) + '#key-1',
                    partyId: party(r.id),
                    agentId: agent(r.id),
                    role: r.role,
                    validFrom: '2020-01-01T00:00:00Z',
                    validUntil: '2035-01-01T00:00:00Z',
                    revokedAt: null,
                },
            ])
        );
        writeFileSync(keyPath, JSON.stringify(keys), { flag: 'wx', mode: 0o600 });
    }
    return JSON.parse(readFileSync(keyPath, 'utf8'));
}
export function serviceCredential() {
    const file = join(runtimeDir, 'service.secret');
    if (!existsSync(file)) writeFileSync(file, randomBytes(48).toString('base64url'), { mode: 0o600, flag: 'wx' });
    return readFileSync(file, 'utf8');
}
export const tokenHash = (value: string) => hash(value).toString('hex');
