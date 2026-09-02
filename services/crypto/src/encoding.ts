import { getSodium } from './sodium';

export async function toB64url(bytes: Uint8Array): Promise<string> {
  const sodium = await getSodium();
  return sodium.to_base64(bytes, sodium.base64_variants.URLSAFE_NO_PADDING);
}

export async function fromB64url(value: string): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.from_base64(value, sodium.base64_variants.URLSAFE_NO_PADDING);
}

export function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function utf8String(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function toBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32[(value << (5 - bits)) & 31];
  }
  return out;
}

export function fromBase32(input: string): Uint8Array {
  const compact = input.toUpperCase().replace(/=+$/u, '');
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of compact) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) {
      throw new RangeError('invalid base32');
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}
