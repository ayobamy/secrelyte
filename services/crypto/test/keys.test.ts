import { describe, expect, it } from 'vitest';
import {
  AAD,
  AuthenticationError,
  asMek,
  generateDek,
  generateKeypair,
  generateLinkKey,
  generateSdek,
  generateVaultKey,
  unwrapDek,
  unwrapSecretKey,
  unwrapVaultKey,
  wrapDek,
  wrapSecretKey,
  wrapVaultKey,
} from '@/services/crypto';

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

describe('key generation', () => {
  it('emits distinct 32-byte vault keys and X25519 pairs across 1000 runs', async () => {
    const vaults = new Set<string>();
    const pubs = new Set<string>();
    const secs = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      const vk = await generateVaultKey();
      const pair = await generateKeypair();
      expect(vk.byteLength).toBe(32);
      expect(pair.publicKey.byteLength).toBe(32);
      expect(pair.secretKey.byteLength).toBe(32);
      vaults.add(toHex(vk));
      pubs.add(toHex(pair.publicKey));
      secs.add(toHex(pair.secretKey));
    }
    expect(vaults.size).toBe(1000);
    expect(pubs.size).toBe(1000);
    expect(secs.size).toBe(1000);
  });

  it('emits DEK, SDEK, and link keys', async () => {
    const dek = await generateDek();
    const sdek = await generateSdek();
    const lk = await generateLinkKey();
    expect(dek.byteLength).toBe(32);
    expect(sdek.byteLength).toBe(32);
    expect(lk.byteLength).toBe(32);
    expect(toHex(dek)).not.toBe(toHex(sdek));
  });
});

describe('wrapping', () => {
  it('round-trips VK, SK, and DEK with AAD binding', async () => {
    const mek = asMek(new Uint8Array(32).fill(8));
    const vk = await generateVaultKey();
    const { secretKey } = await generateKeypair();
    const dek = await generateDek();
    const productId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    const wrappedVk = await wrapVaultKey(mek, vk);
    expect(wrappedVk.aad).toBe(AAD.wrapVk);
    expect(toHex(await unwrapVaultKey(mek, wrappedVk))).toBe(toHex(vk));

    const wrappedSk = await wrapSecretKey(mek, secretKey);
    expect(wrappedSk.aad).toBe(AAD.wrapSk);
    expect(toHex(await unwrapSecretKey(mek, wrappedSk))).toBe(toHex(secretKey));

    const wrappedDek = await wrapDek(vk, dek, productId);
    expect(wrappedDek.aad).toBe(AAD.wrapDek(productId));
    expect(toHex(await unwrapDek(vk, wrappedDek, productId))).toBe(toHex(dek));
  });

  it('rejects a vault wrap presented with the wrong AAD', async () => {
    const mek = asMek(new Uint8Array(32).fill(8));
    const vk = await generateVaultKey();
    const wrapped = await wrapVaultKey(mek, vk);
    await expect(unwrapSecretKey(mek, wrapped)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('rejects DEK unwrap under the wrong product id', async () => {
    const vk = await generateVaultKey();
    const dek = await generateDek();
    const wrapped = await wrapDek(vk, dek, 'product-a');
    await expect(unwrapDek(vk, wrapped, 'product-b')).rejects.toBeInstanceOf(AuthenticationError);
  });
});
