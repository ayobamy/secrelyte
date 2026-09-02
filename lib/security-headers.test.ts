import { describe, expect, it } from 'vitest';
import { buildCsp, gradeHeaders, isStrictPath, securityHeaders } from './security-headers';

describe('isStrictPath', () => {
  it('treats vault and share routes as the no-third-party zone', () => {
    expect(isStrictPath('/vault')).toBe(true);
    expect(isStrictPath('/vault/p/abc')).toBe(true);
    expect(isStrictPath('/s/token')).toBe(true);
    expect(isStrictPath('/')).toBe(false);
  });
});

describe('buildCsp', () => {
  it('starts from default-src none on strict routes', () => {
    const csp = buildCsp({
      nonce: 'abc',
      isDev: false,
      supabaseOrigin: 'https://abcd.supabase.co',
      tier: 'strict',
    });
    expect(csp.startsWith("default-src 'none';")).toBe(true);
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp.includes("'unsafe-eval'")).toBe(false);
    expect(csp).toContain('https://abcd.supabase.co');
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('allows unsafe-eval only in development', () => {
    const csp = buildCsp({
      nonce: 'abc',
      isDev: true,
      supabaseOrigin: null,
      tier: 'marketing',
    });
    expect(csp).toContain('unsafe-eval');
  });
});

describe('securityHeaders + grade', () => {
  it('grades production vault headers as A against the local checklist', () => {
    const headers = securityHeaders({
      pathname: '/vault',
      nonce: 'n',
      isDev: false,
      isProd: true,
      supabaseOrigin: 'https://abcd.supabase.co',
    });
    expect(headers['Referrer-Policy']).toBe('no-referrer');
    expect(headers['Cache-Control']).toContain('no-store');
    expect(headers['Strict-Transport-Security']).toContain('max-age=63072000');
    expect(gradeHeaders(headers, { requireHsts: true }).grade).toBe('A');
  });

  it('omits HSTS on localhost so local HTTPS is not forced', () => {
    const headers = securityHeaders({
      pathname: '/',
      nonce: 'n',
      isDev: true,
      isProd: false,
      supabaseOrigin: null,
    });
    expect(headers['Strict-Transport-Security']).toBeUndefined();
    expect(gradeHeaders(headers, { requireHsts: false }).grade).toBe('A');
  });
});
