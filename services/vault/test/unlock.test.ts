import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as crypto from '@/services/crypto';
import { assembleSignupMaterial, beginUnlock, isUnlocked, lockKeys } from '@/services/vault';

/**
 * The real crypto, with seams that count master-key derivations and keep every MEK handed
 * out, so the tests can see that one unlock derives once and that no MEK outlives it.
 */
const seam = vi.hoisted(() => ({ derivations: 0, meks: [] as Uint8Array[] }));

vi.mock('@/services/crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/crypto')>();
  return {
    ...actual,
    deriveMasterKey: vi.fn(async (...args: Parameters<typeof actual.deriveMasterKey>) => {
      seam.derivations += 1;
      return actual.deriveMasterKey(...args);
    }),
    deriveMek: vi.fn(async (...args: Parameters<typeof actual.deriveMek>) => {
      const mek = await actual.deriveMek(...args);
      seam.meks.push(mek);
      return mek;
    }),
  };
});

const EMAIL = 'unlock@example.com';
const PASSWORD = 'correct-horse-battery-staple-orbit';
const isZeroed = (bytes: Uint8Array) => bytes.every((b) => b === 0);

async function account() {
  const material = await assembleSignupMaterial(EMAIL, PASSWORD);
  const row = {
    wrapped_vault_key: material.wrappedVaultKey,
    wrapped_private_key: material.wrappedPrivateKey,
    recovery_ack_at: null,
  };
  seam.derivations = 0;
  seam.meks.length = 0;
  return { material, row };
}

beforeEach(async () => {
  await crypto.sodiumReady();
});

afterEach(async () => {
  await lockKeys();
});

describe('beginUnlock', () => {
  it('derives the master key once for both the login key and the unlock', async () => {
    const { material, row } = await account();
    const pending = await beginUnlock(EMAIL, PASSWORD, material.kdf);
    expect(pending.authPassword).toBe(material.authPassword);
    await pending.open(row);
    expect(isUnlocked()).toBe(true);
    expect(seam.derivations).toBe(1);
  });

  it('zeroizes the MEK after opening, on success and on a wrong password', async () => {
    const { material, row } = await account();
    const right = await beginUnlock(EMAIL, PASSWORD, material.kdf);
    await right.open(row);
    expect(isZeroed(seam.meks[0]!)).toBe(true);

    await lockKeys();
    const wrong = await beginUnlock(EMAIL, 'totally-wrong-passphrase-xx', material.kdf);
    await expect(wrong.open(row)).rejects.toBeInstanceOf(crypto.AuthenticationError);
    expect(isUnlocked()).toBe(false);
    expect(isZeroed(seam.meks[1]!)).toBe(true);
  });

  it('zeroizes the MEK on discard, when sign-in fails or there is no key row', async () => {
    const { material } = await account();
    const pending = await beginUnlock(EMAIL, PASSWORD, material.kdf);
    expect(isZeroed(seam.meks[0]!)).toBe(false);
    await pending.discard();
    expect(isZeroed(seam.meks[0]!)).toBe(true);
  });

  it('cannot be opened twice, or after it was discarded', async () => {
    const { material, row } = await account();
    const opened = await beginUnlock(EMAIL, PASSWORD, material.kdf);
    await opened.open(row);
    await expect(opened.open(row)).rejects.toThrow('UNLOCK_SPENT');
    await opened.discard();

    const discarded = await beginUnlock(EMAIL, PASSWORD, material.kdf);
    await discarded.discard();
    await expect(discarded.open(row)).rejects.toThrow('UNLOCK_SPENT');
  });

  it('reports a malformed key row as a failed unlock, not a crash', async () => {
    const { material } = await account();
    const pending = await beginUnlock(EMAIL, PASSWORD, material.kdf);
    await expect(
      pending.open({
        wrapped_vault_key: '\\x00',
        wrapped_private_key: '\\x00',
        recovery_ack_at: null,
      }),
    ).rejects.toBeInstanceOf(crypto.AuthenticationError);
    expect(isZeroed(seam.meks[0]!)).toBe(true);
  });
});
