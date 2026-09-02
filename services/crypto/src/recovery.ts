import { entropyToMnemonic, mnemonicToEntropy } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { open, seal } from './aead';
import { fromBase32, toBase32 } from './encoding';
import { hkdfSha256 } from './hkdf';
import { randomBytes32 } from './keys';
import {
  AAD,
  asRk,
  asVk,
  asX25519SecretKey,
  KDF,
  type EnvelopeV1,
  type RK,
  type VK,
  type X25519SecretKey,
} from './types';

export async function generateRecoveryKey(): Promise<RK> {
  return asRk(await randomBytes32());
}

export function recoveryKeyToWords(rk: RK): string {
  return entropyToMnemonic(rk, wordlist);
}

export function recoveryKeyFromWords(words: string): RK {
  return asRk(mnemonicToEntropy(words, wordlist));
}

export function recoveryKeyToBase32(rk: RK): string {
  return toBase32(rk);
}

export function recoveryKeyFromBase32(encoded: string): RK {
  return asRk(fromBase32(encoded));
}

async function recoveryWrapKey(rk: RK): Promise<Uint8Array> {
  return hkdfSha256({ ikm: rk, info: KDF.recoveryInfo, length: 32 });
}

export async function wrapVaultKeyForRecovery(rk: RK, vk: VK): Promise<EnvelopeV1> {
  return seal(await recoveryWrapKey(rk), vk, AAD.wrapVkRk);
}

export async function unwrapVaultKeyFromRecovery(rk: RK, envelope: EnvelopeV1): Promise<VK> {
  return asVk(await open(await recoveryWrapKey(rk), envelope, AAD.wrapVkRk));
}

export async function wrapSecretKeyForRecovery(rk: RK, sk: X25519SecretKey): Promise<EnvelopeV1> {
  return seal(await recoveryWrapKey(rk), sk, AAD.wrapSkRk);
}

export async function unwrapSecretKeyFromRecovery(
  rk: RK,
  envelope: EnvelopeV1,
): Promise<X25519SecretKey> {
  return asX25519SecretKey(await open(await recoveryWrapKey(rk), envelope, AAD.wrapSkRk));
}

export async function generateRecoveryKit(
  vk: VK,
  sk: X25519SecretKey,
): Promise<{
  rk: RK;
  words: string;
  base32: string;
  wrappedVk: EnvelopeV1;
  wrappedSk: EnvelopeV1;
}> {
  const rk = await generateRecoveryKey();
  return {
    rk,
    words: recoveryKeyToWords(rk),
    base32: recoveryKeyToBase32(rk),
    wrappedVk: await wrapVaultKeyForRecovery(rk, vk),
    wrappedSk: await wrapSecretKeyForRecovery(rk, sk),
  };
}
