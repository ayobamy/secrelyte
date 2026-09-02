import { describe, expect, it } from 'vitest';
import { bytesToPgHex } from './bytea';

describe('bytesToPgHex', () => {
  it('encodes bytea as a Postgres hex literal', () => {
    expect(bytesToPgHex(Uint8Array.from([0x0a, 0xff]))).toBe('\\x0aff');
  });
});
