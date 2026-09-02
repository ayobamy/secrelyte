import { describe, expect, it } from 'vitest';
import {
  asBytes24,
  asBytes32,
  deriveAuthKey,
  deriveMasterKey,
  deriveMek,
  deriveSalt,
  fromB64url,
  openString,
  toB64url,
  utf8,
} from '@/services/crypto';
import { sealWithNonce } from '../src/aead';
import vectors from './vectors.json';

describe('frozen vectors', () => {
  it('derives the salt from the mixed-case email', async () => {
    const salt = await deriveSalt(vectors.kdf_salt.email);
    expect(await toB64url(salt)).toBe(vectors.kdf_salt.expected_salt_b64url);
  });

  it('derives the master key', async () => {
    const salt = await deriveSalt(vectors.kdf_salt.email);
    const started = performance.now();
    const mk = await deriveMasterKey(vectors.master_key.password, salt);
    const elapsed = performance.now() - started;
    expect(await toB64url(mk)).toBe(vectors.master_key.expected_mk_b64url);
    expect(elapsed).toBeGreaterThan(50);
  });

  it('separates auth and MEK branches', async () => {
    const salt = await deriveSalt(vectors.kdf_salt.email);
    const mk = await deriveMasterKey(vectors.master_key.password, salt);
    const auth = await deriveAuthKey(mk);
    const mek = await deriveMek(mk);
    expect(await toB64url(auth)).toBe(vectors.branch_separation.expected_auth_b64url);
    expect(await toB64url(mek)).toBe(vectors.branch_separation.expected_mek_b64url);
    expect(vectors.branch_separation.assert).toBe('authKey != MEK');
  });

  it('round-trips the frozen AEAD vector', async () => {
    const key = asBytes32(await fromB64url(vectors.aead_roundtrip.key_b64url));
    const nonce = asBytes24(await fromB64url(vectors.aead_roundtrip.nonce_b64url));
    const env = await sealWithNonce(
      key,
      utf8(vectors.aead_roundtrip.plaintext),
      vectors.aead_roundtrip.aad,
      nonce,
    );
    expect(env.ct).toBe(vectors.aead_roundtrip.expected_ct_b64url);
    expect(await openString(key, env, vectors.aead_roundtrip.aad)).toBe(
      vectors.aead_roundtrip.plaintext,
    );
  });
});
