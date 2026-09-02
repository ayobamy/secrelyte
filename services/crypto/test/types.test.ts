import { describe, expect, it } from 'vitest';
import { unwrapDek, wrapDek, wrapVaultKey, type DEK, type MEK, type VK } from '@/services/crypto';

function brandedCompileCheck(mek: MEK, vk: VK, dek: DEK): void {
  void wrapVaultKey(mek, vk);
  void wrapDek(vk, dek, 'product');
  // @ts-expect-error VK is not a DEK
  void wrapDek(vk, vk, 'product');
  // @ts-expect-error DEK is not a VK
  void unwrapDek(dek, { v: 1, alg: 'xchacha20poly1305', n: '', ct: '', aad: '' }, 'product');
}

describe('branded key types', () => {
  it('rejects a VK where a DEK is required at compile time', () => {
    expect(typeof brandedCompileCheck).toBe('function');
  });
});
