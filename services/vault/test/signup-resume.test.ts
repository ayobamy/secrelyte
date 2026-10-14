import { describe, expect, it } from 'vitest';
import { bytesToPgHex } from '@/lib/bytea';
import { rowFromThisSignup } from '../src/signup-resume';

const material = {
  wrappedVaultKey: Uint8Array.from([1, 2, 3, 4, 5, 6]),
  wrappedPrivateKey: Uint8Array.from([9, 8, 7, 6]),
};

function row(vault: Uint8Array | string, priv: Uint8Array | string) {
  return {
    wrapped_vault_key: typeof vault === 'string' ? vault : bytesToPgHex(vault),
    wrapped_private_key: typeof priv === 'string' ? priv : bytesToPgHex(priv),
    recovery_ack_at: null,
  };
}

// A signup whose answer was lost used to restart with new keys and strand the first account.
describe('rowFromThisSignup', () => {
  it('matches the row this material wrote, as PostgREST returns it', () => {
    expect(
      rowFromThisSignup(row(material.wrappedVaultKey, material.wrappedPrivateKey), material),
    ).toBe(true);
  });

  it('refuses a row from another attempt, even when one key matches', () => {
    const other = Uint8Array.from([1, 2, 3, 4, 5, 7]);
    expect(rowFromThisSignup(row(other, material.wrappedPrivateKey), material)).toBe(false);
    expect(
      rowFromThisSignup(row(material.wrappedVaultKey, Uint8Array.from([9, 8, 7])), material),
    ).toBe(false);
  });

  it('refuses a row it cannot read instead of throwing', () => {
    expect(rowFromThisSignup(row('not bytes', 'not bytes'), material)).toBe(false);
    expect(
      rowFromThisSignup(
        { wrapped_vault_key: null, wrapped_private_key: undefined, recovery_ack_at: null },
        material,
      ),
    ).toBe(false);
  });
});
