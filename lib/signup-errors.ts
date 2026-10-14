export function signupUserMessage(code?: string): string {
  if (code === 'EMAIL_TAKEN') {
    return 'That email already has a vault. Unlock instead.';
  }
  return 'Could not create the account.';
}

export function unlockUserMessage(err: { code?: string; message?: string }): string {
  const code = err.code ?? '';
  const msg = err.message ?? '';
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) {
    return 'Email is not confirmed. In Studio open Authentication, Users, confirm this address, then unlock again.';
  }
  return 'Wrong email or password.';
}

/**
 * Whether a failed sign-in is worth another try. auth-js reports a request that got no answer,
 * or a 5xx from the auth server (a gateway timeout included), as AuthRetryableFetchError, and
 * a 429 asks the client to slow down. Any other answer is about the credentials and will not
 * change on a retry.
 */
export function isRetryableAuthError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const { name, status } = err as { name?: unknown; status?: unknown };
  return name === 'AuthRetryableFetchError' || status === 429;
}

export function isEmailTakenError(err: {
  code?: string;
  status?: number;
  message?: string;
}): boolean {
  if (err.code === 'email_exists' || err.code === 'user_already_exists') return true;
  if (err.status === 422 && /already/i.test(err.message ?? '')) return true;
  return /already been registered/i.test(err.message ?? '');
}

export function isMissingRpcError(err: { code?: string; message?: string }): boolean {
  if (err.code === 'PGRST202') return true;
  return /could not find the function/i.test(err.message ?? '');
}

export function readErrorBits(err: unknown): {
  code: string;
  status: number;
  message: string;
} {
  if (!err || typeof err !== 'object') {
    return { code: '', status: 0, message: '' };
  }
  const rec = err as { code?: unknown; status?: unknown; message?: unknown };
  return {
    code: typeof rec.code === 'string' ? rec.code : '',
    status: typeof rec.status === 'number' ? rec.status : 0,
    message: typeof rec.message === 'string' ? rec.message : '',
  };
}
