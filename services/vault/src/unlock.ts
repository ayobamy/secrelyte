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

export async function authPasswordFor(
  email: string,
  password: string,
  params?: Partial<KdfParams> | null,
): Promise<string> {
  const salt = await deriveSalt(email);
  const mk = await deriveMasterKey(password, salt, asKdf(params));
  const authKey = await deriveAuthKey(mk);
  const mek = await deriveMek(mk);
  const out = await toB64url(authKey);
  await discardMk(mk);
  await zeroize(mek);
  await zeroize(authKey);
  return out;
}

export async function unlockFromOwnKeys(
  email: string,
  password: string,
  row: OwnKeysRow,
  params?: Partial<KdfParams> | null,
): Promise<void> {
  const salt = await deriveSalt(email);
  const mk = await deriveMasterKey(password, salt, asKdf(params));
  const mek = await deriveMek(mk);
  try {
    const wrappedVk = await bytesToEnvelope(bytesFromWire(row.wrapped_vault_key), AAD.wrapVk);
    const wrappedSk = await bytesToEnvelope(bytesFromWire(row.wrapped_private_key), AAD.wrapSk);
    const vk = await unwrapVaultKey(mek, wrappedVk);
    const sk = await unwrapSecretKey(mek, wrappedSk);
    unlockKeys(vk, sk);
  } catch (err) {
    if (err instanceof AuthenticationError) {
      throw err;
    }
    throw new AuthenticationError();
  } finally {
    await discardMk(mk);
    await zeroize(mek);
  }
}
