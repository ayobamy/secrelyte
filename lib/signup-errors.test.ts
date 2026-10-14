import { describe, expect, it } from 'vitest';
import { signupConfirmsEmail } from './signup-confirm';
import {
  isEmailTakenError,
  isMissingRpcError,
  describeThrown,
  isRetryableAuthError,
  thrownSubmitMessage,
  readErrorBits,
  signupUserMessage,
  unlockUserMessage,
} from './signup-errors';

describe('signup error mapping', () => {
  it('maps EMAIL_TAKEN for the form', () => {
    expect(signupUserMessage('EMAIL_TAKEN')).toBe(
      'That email already has a vault. Unlock instead.',
    );
    expect(signupUserMessage('KEYS_FAILED')).toBe('Could not create the account.');
  });

  it('maps unconfirmed GoTrue users without calling it a wrong password', () => {
    expect(
      unlockUserMessage({ code: 'email_not_confirmed', message: 'Email not confirmed' }),
    ).toMatch(/not confirmed/);
    expect(unlockUserMessage({ message: 'Invalid login credentials' })).toBe(
      'Wrong email or password.',
    );
  });

  it('auto-confirms signup until Phase 4 email is required', () => {
    const prev = process.env.SECRELYTE_REQUIRE_EMAIL_CONFIRM;
    delete process.env.SECRELYTE_REQUIRE_EMAIL_CONFIRM;
    expect(signupConfirmsEmail()).toBe(true);
    process.env.SECRELYTE_REQUIRE_EMAIL_CONFIRM = '1';
    expect(signupConfirmsEmail()).toBe(false);
    if (prev === undefined) delete process.env.SECRELYTE_REQUIRE_EMAIL_CONFIRM;
    else process.env.SECRELYTE_REQUIRE_EMAIL_CONFIRM = prev;
  });

  it('detects GoTrue duplicate-email errors without writing .message', () => {
    expect(isEmailTakenError({ code: 'email_exists' })).toBe(true);
    expect(isEmailTakenError({ status: 422, message: 'User already registered' })).toBe(true);
    expect(
      isEmailTakenError({ message: 'A user with this email address has already been registered' }),
    ).toBe(true);
    expect(isEmailTakenError({ message: 'invalid login' })).toBe(false);
  });

  it('detects a missing PostgREST function', () => {
    expect(isMissingRpcError({ code: 'PGRST202' })).toBe(true);
    expect(
      isMissingRpcError({ message: 'Could not find the function public.store_signup_keys' }),
    ).toBe(true);
    expect(isMissingRpcError({ code: '42501', message: 'permission denied' })).toBe(false);
  });

  it('reads getter-only error objects', () => {
    const thrown: { message?: string } = {};
    Object.defineProperty(thrown, 'message', { get: () => 'boom', set: undefined });
    Object.defineProperty(thrown, 'code', { get: () => 'PGRST202' });
    expect(readErrorBits(thrown)).toEqual({
      code: 'PGRST202',
      status: 0,
      message: 'boom',
    });
  });

  // A post-signup sign-in that hit a gateway timeout used to be ignored, stranding the account.
  it('retries a sign-in only on failures that can clear by themselves', () => {
    expect(isRetryableAuthError({ name: 'AuthRetryableFetchError', status: 504 })).toBe(true);
    expect(isRetryableAuthError({ name: 'AuthRetryableFetchError', status: 0 })).toBe(true);
    expect(isRetryableAuthError({ name: 'AuthApiError', status: 429 })).toBe(true);
    expect(isRetryableAuthError({ name: 'AuthApiError', status: 400 })).toBe(false);
    expect(isRetryableAuthError({ name: 'AuthApiError', status: 500 })).toBe(false);
    expect(isRetryableAuthError(null)).toBe(false);
    expect(isRetryableAuthError('timeout')).toBe(false);
  });

  // "Signup failed." named no cause and no next step; a tab older than the deploy looked the
  // same as a dropped connection.
  it('names what to do when a submit throws, by the stage it reached', () => {
    expect(thrownSubmitMessage('derive', 'later')).toBe(
      'Keys could not be derived in this tab. Reload the page and try again.',
    );
    expect(thrownSubmitMessage('send', 'later')).toBe(
      'Could not reach Secrelyte. Check your connection and try again.',
    );
    expect(thrownSubmitMessage('open', 'later')).toBe('later');
  });

  it('cuts a thrown value down to its name, message or event type for the console', () => {
    expect(describeThrown(new TypeError('Failed to fetch'))).toBe('TypeError: Failed to fetch');
    expect(describeThrown({ type: 'error' })).toBe('Event: error');
    expect(describeThrown('boom')).toBe('string');
    expect(describeThrown(new Error('x'.repeat(500)))).toHaveLength(200);
  });

  // A gateway timeout at unlock used to read "Wrong email or password."
  it('does not call a timeout or a rate limit a wrong password', () => {
    const reach = 'Could not reach Secrelyte. Check your connection and try again.';
    expect(unlockUserMessage({ name: 'AuthRetryableFetchError', status: 504 })).toBe(reach);
    expect(unlockUserMessage({ name: 'AuthApiError', status: 429 })).toBe(
      'Too many attempts. Wait a few minutes and try again.',
    );
    expect(
      unlockUserMessage({
        name: 'AuthApiError',
        status: 400,
        message: 'Invalid login credentials',
      }),
    ).toBe('Wrong email or password.');
  });
});
