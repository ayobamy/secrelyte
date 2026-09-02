import { describe, expect, it } from 'vitest';
import {
  asAuthKey,
  asBytes16,
  asBytes24,
  asBytes32,
  asDek,
  asLk,
  asMek,
  asMk,
  asRk,
  asSdek,
  asVk,
  asX25519PublicKey,
  asX25519SecretKey,
  fromB64url,
  fromBase32,
  toB64url,
  toBase32,
  utf8,
  utf8String,
} from '@/services/crypto';

describe('encoding', () => {
  it('round-trips unpadded base64url', async () => {
    const bytes = utf8('secrelyte');
    const encoded = await toB64url(bytes);
    expect(encoded.includes('=')).toBe(false);
    expect(utf8String(await fromB64url(encoded))).toBe('secrelyte');
  });

  it('round-trips RFC 4648 base32', () => {
    const bytes = new Uint8Array([0x00, 0xff, 0x11, 0x22]);
    const encoded = toBase32(bytes);
    expect(fromBase32(encoded.toLowerCase())).toEqual(bytes);
  });

  it('rejects invalid base32', () => {
    expect(() => fromBase32('!!!')).toThrow(/invalid base32/);
  });
});

describe('brand constructors', () => {
  it('accepts the documented lengths', () => {
    expect(asBytes16(new Uint8Array(16)).byteLength).toBe(16);
    expect(asBytes24(new Uint8Array(24)).byteLength).toBe(24);
    expect(asBytes32(new Uint8Array(32)).byteLength).toBe(32);
    expect(asMk(new Uint8Array(32)).byteLength).toBe(32);
    expect(asMek(new Uint8Array(32)).byteLength).toBe(32);
    expect(asAuthKey(new Uint8Array(32)).byteLength).toBe(32);
    expect(asVk(new Uint8Array(32)).byteLength).toBe(32);
    expect(asDek(new Uint8Array(32)).byteLength).toBe(32);
    expect(asSdek(new Uint8Array(32)).byteLength).toBe(32);
    expect(asLk(new Uint8Array(32)).byteLength).toBe(32);
    expect(asRk(new Uint8Array(32)).byteLength).toBe(32);
    expect(asX25519PublicKey(new Uint8Array(32)).byteLength).toBe(32);
    expect(asX25519SecretKey(new Uint8Array(32)).byteLength).toBe(32);
  });

  it('rejects the wrong length for every constructor', () => {
    const short = new Uint8Array(8);
    const checks = [
      () => asBytes16(short),
      () => asBytes24(short),
      () => asBytes32(short),
      () => asMk(short),
      () => asMek(short),
      () => asAuthKey(short),
      () => asVk(short),
      () => asDek(short),
      () => asSdek(short),
      () => asLk(short),
      () => asRk(short),
      () => asX25519PublicKey(short),
      () => asX25519SecretKey(short),
    ];
    for (const check of checks) {
      expect(check).toThrow(RangeError);
    }
  });
});
