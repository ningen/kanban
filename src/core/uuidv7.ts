/**
 * UUIDv7 generation. UUIDv7 is time-ordered: the first 48 bits are the
 * Unix epoch millis, so lexicographic / file ordering approximates
 * creation order. This is self-contained (no third-party dependency).
 */

import { randomBytes } from "node:crypto";

/** Write a 32-bit big-endian value at `offset`. */
function writeUint32BE(bytes: Uint8Array, value: number, offset: number): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

export function uuidv7(): string {
  const bytes = randomBytes(16);
  const now = Date.now();

  // 48-bit big-endian timestamp (millis since epoch).
  const hi = Math.floor(now / 0x1_0000_0000); // high 16 bits
  const lo = now & 0xffff_ffff; // low 32 bits
  writeUint32BE(bytes, lo, 2);
  bytes[0] = (hi >>> 8) & 0xff;
  bytes[1] = hi & 0xff;

  // Version 7 in the high nibble of byte 6 (0x7 << 4 = 0x70).
  const b6 = bytes[6] ?? 0;
  bytes[6] = (b6 & 0x0f) | 0x70;
  // Variant 10xx in the high bits of byte 8 (0x80).
  const b8 = bytes[8] ?? 0;
  bytes[8] = (b8 & 0x3f) | 0x80;

  const hex = Buffer.from(bytes).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export function isValidUuidv7(value: string): boolean {
  const re =
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return re.test(value);
}

/** Extract timestamp (ms since epoch) from a UUIDv7 string, for sort fallback. */
export function uuidv7Timestamp(value: string): number | null {
  const m = value.match(/^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f])/i);
  if (m === null) return null;
  const high = m[1] ?? "";
  const mid = m[2] ?? "";
  if (high.length !== 8 || mid.length !== 4) return null;
  return parseInt(high + mid, 16);
}
