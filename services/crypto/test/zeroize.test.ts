import { describe, expect, it } from 'vitest';
import { withKey, zeroize } from '@/services/crypto';

describe('zeroize', () => {
  it('wipes every provided key and skips holes', async () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([9, 9, 9, 9]);
    await zeroize(a, null, undefined, b);
    expect(Array.from(a)).toEqual([0, 0, 0, 0]);
    expect(Array.from(b)).toEqual([0, 0, 0, 0]);
  });

  it('wipes the key after withKey returns', async () => {
    const key = new Uint8Array(32).fill(7);
    const out = await withKey(key, async (k) => k[0]);
    expect(out).toBe(7);
    expect(key.every((b) => b === 0)).toBe(true);
  });

  it('wipes the key after withKey throws', async () => {
    const key = new Uint8Array(32).fill(7);
    await expect(
      withKey(key, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(key.every((b) => b === 0)).toBe(true);
  });
});
