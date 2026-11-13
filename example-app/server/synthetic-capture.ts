import { deflateSync } from 'node:zlib';

export const captureWidth = 320, captureHeight = 200;
function crc32(bytes: Buffer) {
    let crc = 0xffffffff;
    for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
    return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
    const name = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4);
    length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
    return Buffer.concat([length, name, data, crc]);
}
// Deterministic RGB fixture, not real reflectance or a satellite download. The
// cloud mask occupies the declared fraction of pixels. All bytes are hash-bound.
export function syntheticCapture(cloudCoverPercent: number) {
    const raw = Buffer.alloc((captureWidth * 3 + 1) * captureHeight);
    const cloudPixels = Math.round(captureWidth * captureHeight * cloudCoverPercent / 100);
    for (let y = 0; y < captureHeight; y++) for (let x = 0; x < captureWidth; x++) {
        const offset = y * (captureWidth * 3 + 1) + 1 + x * 3;
        const n = y * captureWidth + x;
        const cloudy = (n * 7919 % (captureWidth * captureHeight)) < cloudPixels;
        const field = (Math.floor(x / 40) + Math.floor(y / 25) * 3) % 5;
        const grid = x % 40 < 2 || y % 25 < 2;
        const colors = [[74, 108, 57], [119, 135, 67], [150, 128, 82], [72, 120, 92], [105, 144, 72]];
        const rgb = cloudy ? [228, 234, 235] : grid ? [168, 157, 109] : colors[field];
        raw.set(rgb, offset);
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(captureWidth); header.writeUInt32BE(captureHeight, 4); header[8] = 8; header[9] = 2;
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
        chunk('tEXt', Buffer.from('Description\0SYNTHETIC DEMO IMAGE. Not an actual satellite acquisition. No carbon estimate is inferred.')),
        chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
    ]);
}
