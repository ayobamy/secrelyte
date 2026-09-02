import { KDF } from './types';
import { getSodium } from './sodium';

export const ARGON2ID = {
  m: KDF.argon2.mKib,
  t: KDF.argon2.t,
  p: KDF.argon2.p,
  v: 1,
} as const;

export const OWASP_MIN_MEMORY_KIB = 19456;

export type KdfParams = {
  m: number;
  t: number;
  p: number;
  v: 1;
};

export type Argon2Job = {
  password: string;
  salt: Uint8Array;
  params?: KdfParams;
};

export function assertArgon2Params(params: KdfParams): void {
  if (params.m < OWASP_MIN_MEMORY_KIB) {
    throw new Error(`KDF memory ${params.m} KiB is below the OWASP minimum`);
  }
}

export async function argon2id32(job: Argon2Job): Promise<Uint8Array> {
  const params = job.params ?? ARGON2ID;
  assertArgon2Params(params);
  const sodium = await getSodium();
  return sodium.crypto_pwhash(
    KDF.argon2.outLen,
    job.password,
    job.salt,
    params.t,
    params.m * 1024,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}
