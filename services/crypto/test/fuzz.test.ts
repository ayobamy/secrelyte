import { describe, expect, it } from 'vitest';
import { AAD, openString, randomNonce, seal, utf8 } from '@/services/crypto';

describe('nonce uniqueness fuzz', () => {
  it('produces 10k distinct nonces', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i += 1) {
      const nonce = await randomNonce();
      const hex = Buffer.from(nonce).toString('hex');
      expect(seen.has(hex)).toBe(false);
      seen.add(hex);
    }
    expect(seen.size).toBe(10_000);
  });
});

describe('random round-trips', () => {
  it('opens 1k sealed payloads', async () => {
    const key = new Uint8Array(32);
    crypto.getRandomValues(key);
    for (let i = 0; i < 1_000; i += 1) {
      const aad = AAD.secret('p', 's', i);
      const env = await seal(key, utf8(`value-${i}`), aad);
      expect(await openString(key, env, aad)).toBe(`value-${i}`);
    }
  });
});
