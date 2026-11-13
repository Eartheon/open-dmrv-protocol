import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { hash, keypair, signObject, verifyObject } from '../server/crypto.ts';
import { readAndCheckAsset } from '../server/assets.ts';

test('Changed bytes at an unchanged asset path fail integrity; changing the signed digest fails its signature', async () => {
    const root = resolve('public/assets');
    mkdirSync(root, { recursive: true });
    const folder = mkdtempSync(resolve(root, 'integrity-test-'));
    const path = resolve(folder, 'samples.csv');
    const bytes = 'sample,SOC\nS01,1.20\n';
    const keys = keypair();
    const descriptor = signObject({ location: { href: path }, integrity: { digest: hash(bytes).toString('hex') } }, keys.privateKey, 'test-key');
    const row = { relative_path: relative(resolve('public'), path), digest: 'sha256:' + descriptor.integrity.digest, custodian: 'measurement' };
    try {
        writeFileSync(path, bytes);
        assert.equal(await readAndCheckAsset(row), bytes);
        writeFileSync(path, bytes.replace('1.20', '9.20'));
        await assert.rejects(() => readAndCheckAsset(row), (error: any) => error.code === 'DIGEST_MISMATCH');
        assert.equal(verifyObject(descriptor, keys.publicKey), true, 'The original signed reference is unchanged');
        descriptor.integrity.digest = hash(bytes.replace('1.20', '9.20')).toString('hex');
        assert.equal(verifyObject(descriptor, keys.publicKey), false, 'Replacing its digest without re-signing invalidates the reference');
    } finally {
        unlinkSync(path);
        rmdirSync(folder);
    }
});
