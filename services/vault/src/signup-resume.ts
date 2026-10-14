import { bytesEqual, bytesFromWire } from './envelope';
import type { SignupMaterial } from './signup-material';
import type { OwnKeysRow } from './unlock';

/**
 * Whether a key row is the one this signup material wrote. Signup can create the account and
 * lose its answer on the way back (a dropped connection, a proxy timeout); the retry then hears
 * that the email is taken. Both wrapped keys carry fresh random nonces, so a byte-for-byte match
 * proves the row came from this material, which means this tab's kit opens it and resuming is
 * safe. Anything else is another attempt's vault, whose 24 words this tab never had.
 */
export function rowFromThisSignup(
  row: OwnKeysRow,
  material: Pick<SignupMaterial, 'wrappedVaultKey' | 'wrappedPrivateKey'>,
): boolean {
  try {
    return (
      bytesEqual(bytesFromWire(row.wrapped_vault_key), material.wrappedVaultKey) &&
      bytesEqual(bytesFromWire(row.wrapped_private_key), material.wrappedPrivateKey)
    );
  } catch {
    return false;
  }
}
