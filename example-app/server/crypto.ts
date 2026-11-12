import { createHash, generateKeyPairSync, sign as ecSign, verify as ecVerify, createPrivateKey, createPublicKey } from 'node:crypto';
import type { Doc } from '../lib/model.ts';

// RFC 8785: ECMAScript primitive serialization; recursive UTF-16 key sorting.
// Reject values outside I-JSON instead of silently changing the protected data.
export function canonicalize(value: unknown): string {
    if (value === null) return 'null';
    if (typeof value === 'string') {
        if (!value.isWellFormed()) throw new Error('Lone surrogate is not I-JSON');
        return JSON.stringify(value);
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new Error('Non-finite number is not I-JSON');
        return JSON.stringify(value);
    }
    if (typeof value === 'boolean') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + Array.from(value, canonicalize).join(',') + ']';
    if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        return (
            '{' +
            Object.keys(value)
                .sort()
                .map((k) => canonicalize(k) + ':' + canonicalize((value as Doc)[k]))
                .join(',') +
            '}'
        );
    }
    throw new Error('Unsupported I-JSON value');
}
export const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest();
export const digest = (value: unknown) => 'sha256:' + hash(canonicalize(value)).toString('hex');
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function base58(bytes: Uint8Array): string {
    let n = BigInt('0x' + (Buffer.from(bytes).toString('hex') || '0')),
        out = '';
    while (n > 0n) {
        out = alphabet[Number(n % 58n)] + out;
        n /= 58n;
    }
    for (const b of bytes) {
        if (b !== 0) break;
        out = '1' + out;
    }
    return out;
}
export function unbase58(input: string): Buffer {
    let n = 0n;
    for (const c of input) {
        const i = alphabet.indexOf(c);
        if (i < 0) throw Error('Invalid base58');
        n = n * 58n + BigInt(i);
    }
    let hex = n.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    return Buffer.concat([Buffer.alloc(input.match(/^1*/)?.[0].length || 0), n === 0n ? Buffer.alloc(0) : Buffer.from(hex, 'hex')]);
}
export function keypair() {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    return {
        privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
        publicKeyJwk: publicKey.export({ format: 'jwk' }),
    };
}
function proofData(document: Doc, proof: Doc) {
    return Buffer.concat([hash(canonicalize(proof)), hash(canonicalize(document))]);
}
export function signObject(document: Doc, privateKey: string, verificationMethod: string, purpose = 'assertionMethod', challenge?: string): Doc {
    const { proof: _unused, ...unsigned } = document;
    const proof: Doc = {
        type: 'DataIntegrityProof',
        cryptosuite: 'ecdsa-jcs-2019',
        created: new Date().toISOString(),
        verificationMethod,
        proofPurpose: purpose,
        domain: 'sandbox.open-dmrv.local',
    };
    if (unsigned['@context']) proof['@context'] = unsigned['@context'];
    if (challenge) proof.challenge = challenge;
    const bytes = ecSign('sha256', proofData(unsigned, proof), { key: createPrivateKey(privateKey), dsaEncoding: 'ieee-p1363' });
    return { ...unsigned, proof: { ...proof, proofValue: 'z' + base58(bytes) } };
}
export function verifyObject(document: Doc, publicKey: string): boolean {
    try {
        const { proof, ...unsigned } = document;
        if (!proof || proof.type !== 'DataIntegrityProof' || proof.cryptosuite !== 'ecdsa-jcs-2019' || !proof.proofValue?.startsWith('z')) return false;
        const { proofValue, ...options } = proof;
        if (options['@context'] && canonicalize(options['@context']) !== canonicalize(unsigned['@context'])) return false;
        const bytes = unbase58(proofValue.slice(1));
        if (bytes.length !== 64) return false;
        return ecVerify('sha256', proofData(unsigned, options), { key: createPublicKey(publicKey), dsaEncoding: 'ieee-p1363' }, bytes);
    } catch {
        return false;
    }
}
