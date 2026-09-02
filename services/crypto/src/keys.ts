import { open, seal } from './aead';
import {
  AAD,
  asDek,
  asLk,
  asSdek,
  asVk,
  asX25519PublicKey,
  asX25519SecretKey,
  type DEK,
  type EnvelopeV1,
  type LK,
  type MEK,
  type SDEK,
  type VK,
  type X25519PublicKey,
  type X25519SecretKey,
} from './types';
import { getSodium } from './sodium';

export async function randomBytes32(): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.randombytes_buf(32);
}

export async function generateVaultKey(): Promise<VK> {
  return asVk(await randomBytes32());
}

export async function generateDek(): Promise<DEK> {
  return asDek(await randomBytes32());
}

export async function generateSdek(): Promise<SDEK> {
  return asSdek(await randomBytes32());
}

export async function generateLinkKey(): Promise<LK> {
  return asLk(await randomBytes32());
}

export async function generateKeypair(): Promise<{
  publicKey: X25519PublicKey;
  secretKey: X25519SecretKey;
}> {
  const sodium = await getSodium();
  const pair = sodium.crypto_box_keypair();
  return {
    publicKey: asX25519PublicKey(pair.publicKey),
    secretKey: asX25519SecretKey(pair.privateKey),
  };
}

export async function wrapVaultKey(mek: MEK, vk: VK): Promise<EnvelopeV1> {
  return seal(mek, vk, AAD.wrapVk);
}

export async function unwrapVaultKey(mek: MEK, envelope: EnvelopeV1): Promise<VK> {
  return asVk(await open(mek, envelope, AAD.wrapVk));
}

export async function wrapSecretKey(mek: MEK, sk: X25519SecretKey): Promise<EnvelopeV1> {
  return seal(mek, sk, AAD.wrapSk);
}

export async function unwrapSecretKey(mek: MEK, envelope: EnvelopeV1): Promise<X25519SecretKey> {
  return asX25519SecretKey(await open(mek, envelope, AAD.wrapSk));
}

export async function wrapDek(vk: VK, dek: DEK, productId: string): Promise<EnvelopeV1> {
  return seal(vk, dek, AAD.wrapDek(productId));
}

export async function unwrapDek(vk: VK, envelope: EnvelopeV1, productId: string): Promise<DEK> {
  return asDek(await open(vk, envelope, AAD.wrapDek(productId)));
}
