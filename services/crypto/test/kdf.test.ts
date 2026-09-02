import { beforeAll, describe, expect, it } from 'vitest';
import {
  ARGON2ID,
  OWASP_MIN_MEMORY_KIB,
  argon2OffMainThreadAvailable,
  asBytes16,
  asMk,
  deriveAuthKey,
  deriveMasterKey,
  deriveMek,
  deriveSalt,
  deriveUnlockMaterial,
  discardMk,
  normalizeEmail,
  toB64url,
  type MK,
} from '@/services/crypto';
import vectors from './vectors.json';

let mk: MK;

describe('email normalization', () => {
  it('is case and surrounding-whitespace insensitive', () => {
    expect(normalizeEmail(vectors.kdf_salt.email)).toBe(vectors.kdf_salt.normalized);
    expect(normalizeEmail('  AHMED@EXAMPLE.COM')).toBe(vectors.kdf_salt.normalized);
  });
});

describe('KDF vectors', () => {
  beforeAll(async () => {
    const salt = await deriveSalt(vectors.kdf_salt.email);
    mk = await deriveMasterKey(vectors.master_key.password, salt);
  });

  it('deriveSalt matches the frozen vector', async () => {
    const salt = await deriveSalt(vectors.kdf_salt.email);
    expect(await toB64url(salt)).toBe(vectors.kdf_salt.expected_salt_b64url);
  });

  it('deriveMasterKey matches the frozen vector', async () => {
    expect(await toB64url(mk)).toBe(vectors.master_key.expected_mk_b64url);
  });

  it('auth and MEK differ and are stable', async () => {
    const authA = await deriveAuthKey(mk);
    const authB = await deriveAuthKey(mk);
    const mek = await deriveMek(mk);
    expect(await toB64url(authA)).toBe(await toB64url(authB));
    expect(await toB64url(authA)).not.toBe(await toB64url(mek));
    expect(await toB64url(authA)).toBe(vectors.branch_separation.expected_auth_b64url);
    expect(await toB64url(mek)).toBe(vectors.branch_separation.expected_mek_b64url);
  });

  it('deriveUnlockMaterial returns the same salt, MK, and branches', async () => {
    const material = await deriveUnlockMaterial(
      vectors.kdf_salt.email,
      vectors.master_key.password,
    );
    expect(await toB64url(material.salt)).toBe(vectors.kdf_salt.expected_salt_b64url);
    expect(await toB64url(material.mk)).toBe(vectors.master_key.expected_mk_b64url);
    expect(await toB64url(material.authKey)).toBe(vectors.branch_separation.expected_auth_b64url);
    expect(await toB64url(material.mek)).toBe(vectors.branch_separation.expected_mek_b64url);
  });
});

describe('Argon2id parameters', () => {
  it('rejects memory below the OWASP floor', async () => {
    const salt = asBytes16(new Uint8Array(16));
    await expect(
      deriveMasterKey('password12chars', salt, { m: OWASP_MIN_MEMORY_KIB - 1, t: 3, p: 1, v: 1 }),
    ).rejects.toThrow(/OWASP minimum/);
  });

  it('uses the frozen Argon2id parameters', () => {
    expect(ARGON2ID).toEqual({ m: 65536, t: 3, p: 1, v: 1 });
    expect(vectors.master_key.params).toEqual({ m: 65536, t: 3, p: 1 });
  });

  it('runs inline in Node where Worker is absent', () => {
    expect(argon2OffMainThreadAvailable()).toBe(false);
  });
});

describe('discardMk', () => {
  it('zeroes the master key bytes', async () => {
    const local = asMk(new Uint8Array(32).fill(11));
    await discardMk(local);
    expect(local.every((b) => b === 0)).toBe(true);
  });
});
