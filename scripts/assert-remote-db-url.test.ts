import { describe, expect, it } from 'vitest';
import {
  assertRemoteDbUrl,
  remoteMigrateAllowed,
  toSessionPoolerUrl,
} from './assert-remote-db-url.mjs';

const ok = 'postgresql://postgres:s3cret%21@db.abcdefghijklmnop.supabase.co:5432/postgres';

describe('assertRemoteDbUrl', () => {
  it('accepts a direct supabase host on 5432', () => {
    expect(assertRemoteDbUrl(ok)).toEqual({
      host: 'db.abcdefghijklmnop.supabase.co',
      port: 5432,
    });
  });

  it('accepts the session pooler on 5432', () => {
    const url =
      'postgresql://postgres.abcdefghijklmnop:s3cret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';
    expect(assertRemoteDbUrl(url).host).toBe('aws-0-eu-central-1.pooler.supabase.com');
  });

  it('rejects a missing value', () => {
    expect(() => assertRemoteDbUrl('')).toThrow(/missing/i);
  });

  it('rejects an API key pasted as the URI', () => {
    expect(() => assertRemoteDbUrl('sb_secret_not_a_database_url')).toThrow(/API key/i);
  });

  it('rejects localhost', () => {
    expect(() =>
      assertRemoteDbUrl('postgresql://postgres:postgres@127.0.0.1:54322/postgres'),
    ).toThrow(/localhost/i);
  });

  it('rejects the transaction pooler port', () => {
    expect(() =>
      assertRemoteDbUrl(
        'postgresql://postgres.abc:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
      ),
    ).toThrow(/6543/);
  });

  it('rejects a non-postgres scheme', () => {
    expect(() => assertRemoteDbUrl('https://abcdefghijklmnop.supabase.co')).toThrow(/postgres/i);
  });

  it('does not echo the password in the error', () => {
    try {
      assertRemoteDbUrl('postgresql://postgres:super-secret-pw@example.com:5432/postgres');
      throw new Error('expected throw');
    } catch (err) {
      expect(String(err)).not.toContain('super-secret-pw');
    }
  });
});

describe('remoteMigrateAllowed', () => {
  it('allows dry-run without the confirm flag', () => {
    expect(remoteMigrateAllowed(true, undefined)).toBe(true);
  });

  it('blocks a live push without the confirm flag', () => {
    expect(remoteMigrateAllowed(false, undefined)).toBe(false);
  });

  it('allows a live push when confirmed', () => {
    expect(remoteMigrateAllowed(false, '1')).toBe(true);
  });
});

describe('toSessionPoolerUrl', () => {
  it('rewrites the IPv6-only direct host to the session pooler', () => {
    const got = toSessionPoolerUrl(ok, 'eu-west-1');
    expect(got.rewritten).toBe(true);
    expect(got.host).toBe('aws-0-eu-west-1.pooler.supabase.com');
    expect(got.url).toContain('postgres.abcdefghijklmnop');
    expect(got.url).toContain('@aws-0-eu-west-1.pooler.supabase.com:5432');
    expect(got.url).not.toContain('db.abcdefghijklmnop.supabase.co');
  });

  it('leaves an existing session pooler URI alone', () => {
    const url =
      'postgresql://postgres.abcdefghijklmnop:s3cret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';
    const got = toSessionPoolerUrl(url, 'eu-west-1');
    expect(got.rewritten).toBe(false);
    expect(got.url).toBe(url);
  });

  it('does not put the password in the returned host field', () => {
    const got = toSessionPoolerUrl(ok, 'eu-west-1');
    expect(got.host).not.toContain('s3cret');
  });
});
