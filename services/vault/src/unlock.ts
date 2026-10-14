import {
  AAD,
  AuthenticationError,
  deriveAuthKey,
  deriveMasterKey,
  deriveMek,
  deriveSalt,
  discardMk,
  toB64url,
  unwrapSecretKey,
  unwrapVaultKey,
  zeroize,
  type KdfParams,
  type MEK,
} from '@/services/crypto';
import { ARGON2ID } from '@/services/crypto';
import { bytesFromWire, bytesToEnvelope } from './envelope';
import { unlockKeys } from './keystore';

export type OwnKeysRow = {
  wrapped_vault_key: unknown;
  wrapped_private_key: unknown;
  recovery_ack_at: string | null;
};

function asKdf(params?: Partial<KdfParams> | null): KdfParams {
  return {
    m: params?.m ?? ARGON2ID.m,
    t: params?.t ?? ARGON2ID.t,
    p: params?.p ?? ARGON2ID.p,
    v: 1,
  };
}

/**
 * One unlock attempt, from a single Argon2id derivation. Unlocking needs two things from the
 * password: the login key the server checks, and the MEK that unwraps the stored keys. Both
 * come from the same master key, which used to be derived twice, the slowest step done twice.
 * The master key is discarded at once; the MEK is held only until open() or discard().
 */
export type PendingUnlock = {
  /** The login key for supabase.auth.signInWithPassword, base64url. */
  authPassword: string;
  /** Unwraps the stored keys and unlocks the vault. Zeroizes the MEK whatever happens. */
  open: (row: OwnKeysRow) => Promise<void>;
  /** Zeroizes the MEK without unlocking: sign-in failed, or there is no key row. */
  discard: () => Promise<void>;
};

export async function beginUnlock(
  email: string,
  password: string,
  params?: Partial<KdfParams> | null,
): Promise<PendingUnlock> {
  const salt = await deriveSalt(email);
  const mk = await deriveMasterKey(password, salt, asKdf(params));
  let mek: MEK;
  let authPassword: string;
  try {
    const authKey = await deriveAuthKey(mk);
    authPassword = await toB64url(authKey);
    await zeroize(authKey);
    mek = await deriveMek(mk);
  } finally {
    await discardMk(mk);
  }
  let spent = false;
  return {
    authPassword,
    open: async (row) => {
      if (spent) throw new Error('UNLOCK_SPENT');
      spent = true;
      try {
        const wrappedVk = await bytesToEnvelope(bytesFromWire(row.wrapped_vault_key), AAD.wrapVk);
        const wrappedSk = await bytesToEnvelope(bytesFromWire(row.wrapped_private_key), AAD.wrapSk);
        const vk = await unwrapVaultKey(mek, wrappedVk);
        const sk = await unwrapSecretKey(mek, wrappedSk);
        unlockKeys(vk, sk);
      } catch (err) {
        if (err instanceof AuthenticationError) throw err;
        throw new AuthenticationError();
      } finally {
        await zeroize(mek);
      }
    },
    discard: async () => {
      if (spent) return;
      spent = true;
      await zeroize(mek);
    },
  };
}

export async function unlockFromOwnKeys(
  email: string,
  password: string,
  row: OwnKeysRow,
  params?: Partial<KdfParams> | null,
): Promise<void> {
  const pending = await beginUnlock(email, password, params);
  await pending.open(row);
}
