import { utf8 } from './encoding';

function copyBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(bytes.byteLength);
  out.set(bytes);
  return out;
}

export async function hkdfSha256(opts: {
  ikm: Uint8Array;
  info: string;
  length: number;
  salt?: Uint8Array;
}): Promise<Uint8Array> {
  const salt = copyBytes(opts.salt ?? new Uint8Array());
  const key = await crypto.subtle.importKey('raw', copyBytes(opts.ikm), 'HKDF', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: copyBytes(utf8(opts.info)) },
    key,
    opts.length * 8,
  );
  return new Uint8Array(bits);
}
