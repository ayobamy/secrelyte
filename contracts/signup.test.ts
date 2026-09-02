import { describe, expect, it } from 'vitest';
import { SignupRequest } from './vault';

describe('SignupRequest', () => {
  const body = {
    email: 'owner@example.com',
    authPassword: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    publicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    wrappedVaultKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    wrappedPrivateKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    recoveryWrappedVaultKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    recoveryWrappedPrivateKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    kdf: { alg: 'argon2id' as const, m: 65536, t: 3, p: 1, v: 1 as const },
  };

  it('parses ciphertext-only signup', () => {
    expect(SignupRequest.parse(body).email).toBe('owner@example.com');
  });

  it('strips a user password field if someone adds one', () => {
    const parsed = SignupRequest.parse({ ...body, password: 'hunter2hunter2' });
    expect(parsed).not.toHaveProperty('password');
  });

  it('rejects weak argon memory', () => {
    expect(SignupRequest.safeParse({ ...body, kdf: { ...body.kdf, m: 1000 } }).success).toBe(false);
  });
});
