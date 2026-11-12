import pg from 'pg';
import type { PoolClient } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getKeys, origin } from './config.ts';
import { roles, party, agent } from '../lib/model.ts';
const globalDb = globalThis as unknown as { dmrvPool?: pg.Pool; dmrvReady?: Promise<void> };
export function pool() {
    if (!process.env.DATABASE_URL) throw Error('DATABASE_URL is required. Configure example-app/.env.local.');
    return (globalDb.dmrvPool ??= new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        application_name: 'open-dmrv-example',
        ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    }));
}
export async function transaction<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
    const db = await pool().connect();
    try {
        await db.query('BEGIN');
        const result = await fn(db);
        await db.query('COMMIT');
        return result;
    } catch (error) {
        await db.query('ROLLBACK');
        throw error;
    } finally {
        db.release();
    }
}
export async function initialize() {
    if (globalDb.dmrvReady) return globalDb.dmrvReady;
    globalDb.dmrvReady = transaction(async (db) => {
        await db.query("SELECT pg_advisory_xact_lock(hashtext('open-dmrv:migration:v1'))");
        await db.query(readFileSync(resolve('db/migrations/001_core.sql'), 'utf8'));
        const keys = getKeys();
        for (const role of roles) {
            const k = keys[role.id];
            await db.query('INSERT INTO dmrv.parties(id,profile_id,name,person_name,role) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING', [
                party(role.id),
                role.id,
                role.org,
                role.person,
                role.role,
            ]);
            await db.query(
                'INSERT INTO dmrv.agents(id,party_id,role,callback_origin) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET callback_origin=EXCLUDED.callback_origin',
                [agent(role.id), party(role.id), role.role, origin]
            );
            await db.query(
                'INSERT INTO dmrv.verification_methods(id,party_id,agent_id,public_key_pem,public_key_jwk,role,valid_from,valid_until) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING',
                [k.id, party(role.id), agent(role.id), k.publicKey, k.publicKeyJwk, role.role, k.validFrom, k.validUntil]
            );
            const stored = await db.query('SELECT public_key_pem FROM dmrv.verification_methods WHERE id=$1', [k.id]);
            if (stored.rows[0].public_key_pem !== k.publicKey)
                throw Error(
                    'Local signing keys do not match the database trust registry. Restore the existing runtime keys; do not overwrite registered keys.'
                );
        }
    }).catch((error) => {
        globalDb.dmrvReady = undefined;
        throw error;
    });
    return globalDb.dmrvReady;
}
