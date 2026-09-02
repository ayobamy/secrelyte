import {
  ARGON2ID,
  discardMk,
  deriveUnlockMaterial,
  generateKeypair,
  generateRecoveryKit,
  generateVaultKey,
  toB64url,
  wrapSecretKey,
  wrapSecretKeyForRecovery,
  wrapVaultKey,
  wrapVaultKeyForRecovery,
  zeroize,
  type EnvelopeV1,
  type KdfParams,
  type RK,
  type VK,
  type X25519PublicKey,
  type X25519SecretKey,
} from '@/services/crypto';
import { envelopeToBytes } from './envelope';

export type SignupKdf = KdfParams & { alg: 'argon2id' };

export type SignupMaterial = {
  email: string;
  authPassword: string;
  publicKey: Uint8Array;
  wrappedVaultKey: Uint8Array;
  wrappedPrivateKey: Uint8Array;
  recoveryWrappedVaultKey: Uint8Array;
  recoveryWrappedPrivateKey: Uint8Array;
  kdf: SignupKdf;
  kit: {
    words: string[];
    phrase: string;
    base32: string;
    rk: RK;
  };
  vk: VK;
  sk: X25519SecretKey;
  pk: X25519PublicKey;
};

export async function assembleSignupMaterial(
  email: string,
  password: string,
): Promise<SignupMaterial> {
  const { mk, authKey, mek } = await deriveUnlockMaterial(email, password);
  const vk = await generateVaultKey();
  const pair = await generateKeypair();
  const wrappedVkEnv = await wrapVaultKey(mek, vk);
  const wrappedSkEnv = await wrapSecretKey(mek, pair.secretKey);
  const kit = await generateRecoveryKit(vk, pair.secretKey);
  const authPassword = await toB64url(authKey);
  await discardMk(mk);
  await zeroize(mek);
  await zeroize(authKey);

  return {
    email,
    authPassword,
    publicKey: pair.publicKey,
    wrappedVaultKey: await envelopeToBytes(wrappedVkEnv),
    wrappedPrivateKey: await envelopeToBytes(wrappedSkEnv),
    recoveryWrappedVaultKey: await envelopeToBytes(kit.wrappedVk),
    recoveryWrappedPrivateKey: await envelopeToBytes(kit.wrappedSk),
    kdf: { alg: 'argon2id', m: ARGON2ID.m, t: ARGON2ID.t, p: ARGON2ID.p, v: 1 },
    kit: {
      words: kit.words.split(' '),
      phrase: kit.words,
      base32: kit.base32,
      rk: kit.rk,
    },
    vk,
    sk: pair.secretKey,
    pk: pair.publicKey,
  };
}

export async function wrapForPasswordChange(
  vk: VK,
  sk: X25519SecretKey,
  newPassword: string,
  email: string,
): Promise<{
  authPassword: string;
  wrappedVaultKey: Uint8Array;
  wrappedPrivateKey: Uint8Array;
  kdf: SignupKdf;
}> {
  const { mk, authKey, mek } = await deriveUnlockMaterial(email, newPassword);
  const wrappedVk = await wrapVaultKey(mek, vk);
  const wrappedSk = await wrapSecretKey(mek, sk);
  const authPassword = await toB64url(authKey);
  await discardMk(mk);
  await zeroize(mek);
  await zeroize(authKey);
  return {
    authPassword,
    wrappedVaultKey: await envelopeToBytes(wrappedVk),
    wrappedPrivateKey: await envelopeToBytes(wrappedSk),
    kdf: { alg: 'argon2id', m: ARGON2ID.m, t: ARGON2ID.t, p: ARGON2ID.p, v: 1 },
  };
}

export async function envelopesFromKit(
  rk: RK,
  vk: VK,
  sk: X25519SecretKey,
): Promise<{ wrappedVk: EnvelopeV1; wrappedSk: EnvelopeV1 }> {
  return {
    wrappedVk: await wrapVaultKeyForRecovery(rk, vk),
    wrappedSk: await wrapSecretKeyForRecovery(rk, sk),
  };
}
