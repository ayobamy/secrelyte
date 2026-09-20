import { describe, expect, it } from 'vitest';
import { clientEnvSchema, supabaseOriginFromUrl } from './env';

describe('clientEnvSchema', () => {
  const valid = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://abcd.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_testkey',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  };

  it('accepts new-format publishable keys', () => {
    expect(clientEnvSchema.parse(valid).NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toMatch(
      /^sb_publishable_/,
    );
  });

  it('rejects a legacy anon key in the publishable slot', () => {
    const result = clientEnvSchema.safeParse({
      ...valid,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.legacy',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a secret key accidentally placed in a public var', () => {
    const result = clientEnvSchema.safeParse({
      ...valid,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_should_never_be_public',
    });
    expect(result.success).toBe(false);
  });
});

describe('supabaseOriginFromUrl', () => {
  it('strips the path and keeps origin for CSP connect-src', () => {
    expect(supabaseOriginFromUrl('https://abcd.supabase.co/rest/v1')).toBe(
      'https://abcd.supabase.co',
    );
  });
});
