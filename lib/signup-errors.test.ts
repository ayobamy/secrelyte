import { describe, expect, it } from 'vitest';
import {
  isEmailTakenError,
  isMissingRpcError,
  readErrorBits,
  signupConfirmsEmail,
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
});
