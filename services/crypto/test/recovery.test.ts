import { describe, expect, it } from 'vitest';
import {
  AAD,
  generateKeypair,
  generateRecoveryKit,
  generateVaultKey,
  recoveryKeyFromBase32,
  recoveryKeyFromWords,
  recoveryKeyToBase32,
  recoveryKeyToWords,
  unwrapSecretKeyFromRecovery,
  unwrapVaultKeyFromRecovery,
} from '@/services/crypto';

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

describe('recovery kit', () => {
  it('round-trips 24 BIP-39 words and base32 to the same 32 bytes', async () => {
    const vk = await generateVaultKey();
    const { secretKey } = await generateKeypair();
    const kit = await generateRecoveryKit(vk, secretKey);
    expect(kit.words.split(' ')).toHaveLength(24);
    expect(toHex(recoveryKeyFromWords(kit.words))).toBe(toHex(kit.rk));
    expect(recoveryKeyToWords(kit.rk)).toBe(kit.words);
    expect(toHex(recoveryKeyFromBase32(kit.base32))).toBe(toHex(kit.rk));
    expect(recoveryKeyToBase32(kit.rk)).toBe(kit.base32);
    expect(recoveryKeyFromBase32(`${kit.base32}====`)).toEqual(kit.rk);

    expect(kit.wrappedVk.aad).toBe(AAD.wrapVkRk);
    expect(kit.wrappedSk.aad).toBe(AAD.wrapSkRk);
    expect(toHex(await unwrapVaultKeyFromRecovery(kit.rk, kit.wrappedVk))).toBe(toHex(vk));
    expect(toHex(await unwrapSecretKeyFromRecovery(kit.rk, kit.wrappedSk))).toBe(toHex(secretKey));
  });

  it('rejects a checksum-invalid mnemonic', () => {
    const words = `${'abandon '.repeat(23)}zoo`;
    expect(() => recoveryKeyFromWords(words.trim())).toThrow();
  });
});
