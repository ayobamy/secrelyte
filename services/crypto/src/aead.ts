import { AuthenticationError } from './errors';
import { fromB64url, toB64url, utf8, utf8String } from './encoding';
import { getSodium } from './sodium';
import { asBytes24, type Bytes24, type EnvelopeV1 } from './types';

export async function randomNonce(): Promise<Bytes24> {
  const sodium = await getSodium();
  return asBytes24(sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES));
}

export async function sealWithNonce(
  key: Uint8Array,
  plaintext: Uint8Array,
  aad: string,
  nonce: Bytes24,
): Promise<EnvelopeV1> {
  const sodium = await getSodium();
  const ct = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    utf8(aad),
    null,
    nonce,
    key,
  );
  return {
    v: 1,
    alg: 'xchacha20poly1305',
    n: await toB64url(nonce),
    ct: await toB64url(ct),
    aad,
  };
}

export async function seal(
  key: Uint8Array,
  plaintext: Uint8Array,
  aad: string,
): Promise<EnvelopeV1> {
  return sealWithNonce(key, plaintext, aad, await randomNonce());
}

export async function open(
  key: Uint8Array,
  envelope: EnvelopeV1,
  expectedAad: string,
): Promise<Uint8Array> {
  if (envelope.v !== 1 || envelope.alg !== 'xchacha20poly1305') {
    throw new AuthenticationError('unsupported envelope');
  }
  if (envelope.aad !== expectedAad) {
    throw new AuthenticationError('aad mismatch');
  }
  const sodium = await getSodium();
  try {
    const nonce = await fromB64url(envelope.n);
    const ct = await fromB64url(envelope.ct);
    return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ct,
      utf8(expectedAad),
      nonce,
      key,
    );
  } catch {
    throw new AuthenticationError();
  }
}

export async function sealString(key: Uint8Array, value: string, aad: string): Promise<EnvelopeV1> {
  return seal(key, utf8(value), aad);
}

export async function openString(
  key: Uint8Array,
  envelope: EnvelopeV1,
  expectedAad: string,
): Promise<string> {
  const bytes = await open(key, envelope, expectedAad);
  return utf8String(bytes);
}
