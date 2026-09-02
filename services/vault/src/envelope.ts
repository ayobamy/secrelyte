import { fromB64url, toB64url } from '@/services/crypto';
import type { EnvelopeV1 } from '@/services/crypto';

const NONCE_LEN = 24;

export async function envelopeToBytes(envelope: EnvelopeV1): Promise<Uint8Array> {
  const nonce = await fromB64url(envelope.n);
  const ct = await fromB64url(envelope.ct);
  const out = new Uint8Array(nonce.byteLength + ct.byteLength);
  out.set(nonce, 0);
  out.set(ct, nonce.byteLength);
  return out;
}

export async function bytesToEnvelope(bytes: Uint8Array, aad: string): Promise<EnvelopeV1> {
  if (bytes.byteLength <= NONCE_LEN) {
    throw new RangeError('wrap blob too short');
  }
  const nonce = bytes.subarray(0, NONCE_LEN);
  const ct = bytes.subarray(NONCE_LEN);
  return {
    v: 1,
    alg: 'xchacha20poly1305',
    n: await toB64url(nonce),
    ct: await toB64url(ct),
    aad,
  };
}

export function hexToBytes(hex: string): Uint8Array {
  const raw = hex.startsWith('\\x') ? hex.slice(2) : hex.startsWith('0x') ? hex.slice(2) : hex;
  if (raw.length % 2 !== 0) {
    throw new RangeError('odd hex length');
  }
  const out = new Uint8Array(raw.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(raw.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesFromWire(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (typeof value === 'string') {
    if (value.startsWith('\\x') || /^[0-9a-fA-F]+$/.test(value)) {
      return hexToBytes(value);
    }
  }
  throw new TypeError('unsupported bytea wire type');
}

export { bytesToPgHex } from '@/lib/bytea';
