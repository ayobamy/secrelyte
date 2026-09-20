import { describe, expect, it } from 'vitest';
import { serverEnvSchema, supabaseAdminEnvSchema } from './env.server';

describe('serverEnvSchema', () => {
  it('accepts a secret key with the sb_secret_ prefix', () => {
    expect(
      serverEnvSchema.parse({ SUPABASE_SECRET_KEY: 'sb_secret_testkey' }).SUPABASE_SECRET_KEY,
    ).toMatch(/^sb_secret_/);
  });

  it('rejects a publishable key in the secret slot', () => {
    const result = serverEnvSchema.safeParse({
      SUPABASE_SECRET_KEY: 'sb_publishable_wrong_slot',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a 64-char non-hex SHARE_SESSION_SECRET', () => {
    const result = serverEnvSchema.safeParse({
      SUPABASE_SECRET_KEY: 'sb_secret_testkey',
      SHARE_SESSION_SECRET: 'z'.repeat(64),
    });
    expect(result.success).toBe(false);
  });
});

describe('supabaseAdminEnvSchema', () => {
  it('accepts URL + secret key without Phase 4 peppers', () => {
    const parsed = supabaseAdminEnvSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: 'https://abcd.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_testkey',
    });
    expect(parsed.SUPABASE_SECRET_KEY).toMatch(/^sb_secret_/);
  });
});
