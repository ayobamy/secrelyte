import { ARGON2ID, argon2id32, assertArgon2Params, type KdfParams } from './argon2';
import { hkdfSha256 } from './hkdf';
import { utf8 } from './encoding';
import {
  asAuthKey,
  asBytes16,
  asMk,
  asMek,
  KDF,
  type AuthKey,
  type Bytes16,
  type MK,
  type MEK,
} from './types';
import { zeroize } from './zeroize';

export { ARGON2ID, OWASP_MIN_MEMORY_KIB, type KdfParams } from './argon2';

export const ARGON2_WORKER_TIMEOUT_MS = 60_000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function deriveSalt(email: string): Promise<Bytes16> {
  const ikm = utf8(normalizeEmail(email));
  const salt = await hkdfSha256({ ikm, info: KDF.saltInfo, length: 16 });
  return asBytes16(salt);
}

export function argon2OffMainThreadAvailable(): boolean {
  return typeof Worker !== 'undefined';
}

export function argon2InWorker(
  password: string,
  salt: Bytes16,
  params: KdfParams = ARGON2ID,
  worker: Worker,
  timeoutMs = ARGON2_WORKER_TIMEOUT_MS,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('argon2 worker timeout'));
    }, timeoutMs);
    worker.onmessage = (
      event: MessageEvent<{ ok: true; mk: Uint8Array } | { ok: false; error: string }>,
    ) => {
      clearTimeout(timer);
      worker.terminate();
      if (event.data.ok) {
        resolve(new Uint8Array(event.data.mk));
        return;
      }
      reject(new Error(event.data.error));
    };
    worker.onerror = (err) => {
      clearTimeout(timer);
      worker.terminate();
      reject(err);
    };
    worker.postMessage({ password, salt, params });
  });
}

function spawnArgon2Worker(): Worker {
  return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
}

async function argon2idMk(password: string, salt: Bytes16, params: KdfParams): Promise<MK> {
  assertArgon2Params(params);
  if (typeof Worker === 'undefined') {
    const mk = await argon2id32({ password, salt, params });
    return asMk(mk);
  }
  const mk = await argon2InWorker(password, salt, params, spawnArgon2Worker());
  return asMk(mk);
}

export async function deriveMasterKey(
  password: string,
  salt: Bytes16,
  params: KdfParams = ARGON2ID,
): Promise<MK> {
  return argon2idMk(password, salt, params);
}

export async function deriveAuthKey(mk: MK): Promise<AuthKey> {
  const out = await hkdfSha256({ ikm: mk, info: KDF.authInfo, length: 32 });
  return asAuthKey(out);
}

export async function deriveMek(mk: MK): Promise<MEK> {
  const out = await hkdfSha256({ ikm: mk, info: KDF.mekInfo, length: 32 });
  return asMek(out);
}

export async function deriveUnlockMaterial(
  email: string,
  password: string,
): Promise<{ salt: Bytes16; mk: MK; authKey: AuthKey; mek: MEK }> {
  const salt = await deriveSalt(email);
  const mk = await deriveMasterKey(password, salt);
  const authKey = await deriveAuthKey(mk);
  const mek = await deriveMek(mk);
  return { salt, mk, authKey, mek };
}

export async function discardMk(mk: MK): Promise<void> {
  await zeroize(mk);
}
