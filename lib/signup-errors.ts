export function signupConfirmsEmail(): boolean {
  return process.env.SECRELYTE_REQUIRE_EMAIL_CONFIRM !== '1';
}

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
