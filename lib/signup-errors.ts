export function signupUserMessage(code?: string): string {
  if (code === 'EMAIL_TAKEN') {
    return 'That email already has a vault. Unlock instead.';
  }
  return 'Could not create the account.';
}

export function unlockUserMessage(err: {
  code?: string;
  message?: string;
  name?: string;
  status?: number;
}): string {
  const code = err.code ?? '';
  const msg = err.message ?? '';
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) {
    return 'Email is not confirmed. In Studio open Authentication, Users, confirm this address, then unlock again.';
  }
  // A timeout, a 5xx or a rate limit says nothing about the password.
  if (err.status === 429) return RATE_LIMITED_MESSAGE;
  if (isRetryableAuthError(err)) return NO_ANSWER_MESSAGE;
  return 'Wrong email or password.';
}

/** Where a sign-in form's submit had got to when it threw instead of getting an answer. */
export type SubmitStage = 'derive' | 'send' | 'open';

export const NO_ANSWER_MESSAGE = 'Could not reach Secrelyte. Check your connection and try again.';

/** The auth server's rate limit: the connection is fine, and trying again at once fails again. */
export const RATE_LIMITED_MESSAGE = 'Too many attempts. Wait a few minutes and try again.';

/**
 * Signup sent its request and no answer came back (a dropped connection, a proxy timeout). The
 * server may have created the vault, so this page keeps what it sent: pressing Create vault
 * again resends it and picks the vault up if it exists. A reload would lose that.
 */
export const SIGNUP_UNANSWERED_MESSAGE =
  'No answer came back, so the vault may have been created. Press Create vault again on this page, without reloading, to finish.';

/**
 * The message for a submit that threw. Deriving fails when this tab's code is older than the
 * site (a deploy since the page loaded, so the key worker's file is gone) or the browser refused
 * the worker; a reload fixes both. Sending fails when the request got no answer. Anything later
 * keeps the form's own message.
 */
export function thrownSubmitMessage(stage: SubmitStage, later: string): string {
  if (stage === 'derive') {
    return 'Keys could not be derived in this tab. Reload the page and try again.';
  }
  if (stage === 'send') return NO_ANSWER_MESSAGE;
  return later;
}

/**
 * A thrown value cut down for the console: its name and message, or an event's type (a worker
 * that failed to load rejects with an Event). Never the stack or anything the form holds.
 */
export function describeThrown(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`.slice(0, 200);
  if (err && typeof err === 'object' && 'type' in err && typeof err.type === 'string') {
    return `Event: ${err.type}`;
  }
  return typeof err;
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
