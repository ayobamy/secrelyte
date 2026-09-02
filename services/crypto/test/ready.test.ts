import { describe, expect, it } from 'vitest';
import { sodiumReady } from '@/services/crypto';

describe('sodiumReady', () => {
  it('returns the same promise for concurrent callers', async () => {
    const a = sodiumReady();
    const b = sodiumReady();
    expect(a).toBe(b);
    const sodium = await a;
    expect(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES).toBe(24);
  });
});
