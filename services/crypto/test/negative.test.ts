import { describe, expect, it } from 'vitest';
import {
  AAD,
  AuthenticationError,
  asBytes24,
  asBytes32,
  fromB64url,
  open,
  openString,
  seal,
  sealString,
  toB64url,
  utf8,
  type EnvelopeV1,
} from '@/services/crypto';
import { sealWithNonce } from '../src/aead';
import vectors from './vectors.json';

const PRODUCT_A = '11111111-1111-1111-1111-111111111111';
const PRODUCT_B = '33333333-3333-3333-3333-333333333333';
const SECRET = '22222222-2222-2222-2222-222222222222';

async function flipB64url(value: string, byteIndex = 0): Promise<string> {
  const bytes = await fromB64url(value);
  bytes[byteIndex] ^= 0xff;
  return toB64url(bytes);
}

describe('AEAD frozen vector', () => {
  it('decrypts the frozen ciphertext', async () => {
    const key = asBytes32(await fromB64url(vectors.aead_roundtrip.key_b64url));
    const nonce = asBytes24(await fromB64url(vectors.aead_roundtrip.nonce_b64url));
    const env = await sealWithNonce(
      key,
      utf8(vectors.aead_roundtrip.plaintext),
      vectors.aead_roundtrip.aad,
      nonce,
    );
    expect(env.ct).toBe(vectors.aead_roundtrip.expected_ct_b64url);
    expect(env.n).toBe(vectors.aead_roundtrip.expected_n_b64url);
    const opened = await openString(key, env, vectors.aead_roundtrip.aad);
    expect(opened).toBe(vectors.aead_roundtrip.plaintext);
  });
});

describe('AEAD negative cases', () => {
  async function sealed() {
    const key = asBytes32(await fromB64url(vectors.aead_roundtrip.key_b64url));
    const env = await seal(key, utf8(vectors.aead_roundtrip.plaintext), vectors.aead_roundtrip.aad);
    return { key, env };
  }

  it('rejects a swapped product AAD and returns no plaintext', async () => {
    const { key, env } = await sealed();
    const wrong = vectors.aad_mismatch_must_fail.decrypt_with_aad;
    await expect(open(key, env, wrong)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('rejects a replayed version AAD', async () => {
    const { key, env } = await sealed();
    await expect(open(key, env, AAD.secret(PRODUCT_A, SECRET, 2))).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it('rejects a bit-flip in ciphertext', async () => {
    const { key, env } = await sealed();
    const flipped: EnvelopeV1 = { ...env, ct: await flipB64url(env.ct) };
    await expect(open(key, flipped, env.aad)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('rejects a bit-flip in the nonce', async () => {
    const { key, env } = await sealed();
    const flipped: EnvelopeV1 = { ...env, n: await flipB64url(env.n) };
    await expect(open(key, flipped, env.aad)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('rejects truncated ciphertext', async () => {
    const { key, env } = await sealed();
    const truncated: EnvelopeV1 = { ...env, ct: env.ct.slice(0, 8) };
    await expect(open(key, truncated, env.aad)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('rejects the wrong key', async () => {
    const { env } = await sealed();
    const other = asBytes32(new Uint8Array(32).fill(2));
    await expect(open(other, env, env.aad)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('rejects an unsupported envelope version', async () => {
    const { key, env } = await sealed();
    const bad = { ...env, v: 2 } as unknown as EnvelopeV1;
    await expect(open(key, bad, env.aad)).rejects.toMatchObject({
      message: 'unsupported envelope',
    });
  });

  it('rejects an unsupported algorithm', async () => {
    const { key, env } = await sealed();
    const bad = { ...env, alg: 'aes-256-gcm' } as unknown as EnvelopeV1;
    await expect(open(key, bad, env.aad)).rejects.toMatchObject({
      message: 'unsupported envelope',
    });
  });

  it('uses one error type for every decrypt failure', async () => {
    const { key, env } = await sealed();
    const causes = await Promise.allSettled([
      open(key, { ...env, ct: await flipB64url(env.ct) }, env.aad),
      open(asBytes32(new Uint8Array(32).fill(4)), env, env.aad),
      open(key, { ...env, n: await flipB64url(env.n) }, env.aad),
    ]);
    for (const result of causes) {
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(result.reason).toBeInstanceOf(AuthenticationError);
        expect((result.reason as Error).message).toBe('authentication failed');
      }
    }
  });

  it('round-trips sealString and openString', async () => {
    const key = asBytes32(new Uint8Array(32).fill(5));
    const aad = AAD.share('share-id');
    const env = await sealString(key, 'hello', aad);
    expect(await openString(key, env, aad)).toBe('hello');
    expect(AAD.shareWrap('share-id')).toBe('share:wrap|share-id');
    expect(AAD.wrapDek(PRODUCT_B)).toBe(`wrap:dek:v1|${PRODUCT_B}`);
  });
});
