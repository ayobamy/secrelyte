import { getSecretKey, getVaultKey } from './keystore';
import { scorePassword } from './password';
import { wrapForPasswordChange, type SignupKdf } from './signup-material';

export class AuthUpdatePendingError extends Error {
  readonly name = 'AuthUpdatePendingError';
  constructor(message = 'wraps rotated; retry the auth password update') {
    super(message);
  }
}

export type RotateWrappedArgs = {
  wrappedVaultKey: Uint8Array;
  wrappedPrivateKey: Uint8Array;
  kdf: SignupKdf;
};

let pendingAuthPassword: string | null = null;

export function peekPendingAuthPassword(): string | null {
  return pendingAuthPassword;
}

export function clearPendingAuthPassword(): void {
  pendingAuthPassword = null;
}

/**
 * Wraps first, then GoTrue. Reverse order authenticates with a password that
 * cannot unwrap. If GoTrue fails after rotate, retry updateAuthPassword only.
 */
export async function applyPasswordChange(input: {
  email: string;
  newPassword: string;
  rotateWrapped: (args: RotateWrappedArgs) => Promise<void>;
  updateAuthPassword: (authPassword: string) => Promise<void>;
}): Promise<void> {
  const scored = scorePassword(input.newPassword);
  if (!scored.ok) {
    throw new Error(scored.reason ?? 'WEAK_PASSWORD');
  }
  const next = await wrapForPasswordChange(
    getVaultKey(),
    getSecretKey(),
    input.newPassword,
    input.email,
  );
  pendingAuthPassword = next.authPassword;
  await input.rotateWrapped({
    wrappedVaultKey: next.wrappedVaultKey,
    wrappedPrivateKey: next.wrappedPrivateKey,
    kdf: next.kdf,
  });
  try {
    await input.updateAuthPassword(next.authPassword);
    pendingAuthPassword = null;
  } catch (err) {
    throw new AuthUpdatePendingError(err instanceof Error ? err.message : 'AUTH_UPDATE_FAILED');
  }
}

export async function retryAuthPasswordUpdate(
  updateAuthPassword: (authPassword: string) => Promise<void>,
): Promise<void> {
  if (!pendingAuthPassword) {
    throw new Error('NO_PENDING_AUTH');
  }
  await updateAuthPassword(pendingAuthPassword);
  pendingAuthPassword = null;
}
