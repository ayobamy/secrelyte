import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AAD } from '@/services/crypto';
import { CLIPBOARD_CLEAR_MS, IDLE_LOCK_MS, REVEAL_MS } from '@/services/vault';

describe('vault invariants eval', () => {
  it('keeps idle lock at 15 minutes, reveal 30s, clipboard 45s', () => {
    expect(IDLE_LOCK_MS).toBe(15 * 60 * 1000);
    expect(REVEAL_MS).toBe(30_000);
    expect(CLIPBOARD_CLEAR_MS).toBe(45_000);
  });

  it('binds secret AAD to product, secret, and version', () => {
    const aad = AAD.secret('p', 's', 3);
    expect(aad).toBe('secret:v1|p|s|3');
  });

  it('signup API never mentions a user password field', () => {
    const src = readFileSync('app/api/signup/route.ts', 'utf8');
    expect(src).not.toMatch(/body\.password/);
    expect(src).toContain('authPassword');
    expect(src).toContain('bytesToPgHex');
    expect(src).toContain("rpc('store_signup_keys'");
    expect(src).toContain('signupConfirmsEmail');
    expect(src).toContain('@/lib/signup-confirm');
    expect(src).not.toContain('SECRELYTE_AUTO_CONFIRM');
  });

  it('keeps signup confirm off the client module', () => {
    const forms = readFileSync('components/auth-forms.tsx', 'utf8');
    expect(forms).not.toMatch(/signup-confirm/);
    expect(forms).not.toMatch(/signupConfirmsEmail/);
    const confirm = readFileSync('lib/signup-confirm.ts', 'utf8');
    expect(confirm.startsWith("import 'server-only'")).toBe(true);
  });

  it('admin client does not parse Phase 4 peppers', () => {
    const src = readFileSync('lib/supabase/admin.ts', 'utf8');
    expect(src).toContain('getSupabaseAdminEnv');
    expect(src).not.toMatch(/getServerEnv/);
    expect(src).not.toMatch(/SHARE_SESSION_SECRET/);
    expect(src).not.toMatch(/EMAIL_BLIND_INDEX_PEPPER/);
  });

  // Every product DEK the vault UI opens or creates is zeroed in a finally, so a throw from
  // sealing, opening, or the insert cannot leave key material in memory.
  it('zeroes every product DEK the vault UI acquires, on every path', () => {
    const src = readFileSync('components/vault-app.tsx', 'utf8');
    const acquired = src.match(/await (openProductDek|wrapNewProductDek)\(/g) ?? [];
    const zeroed = src.match(/finally \{\s*(?:\/\/[^\n]*\n\s*)*await discardDek\(dek\)/g) ?? [];
    expect(acquired.length).toBeGreaterThan(0);
    expect(zeroed.length).toBe(acquired.length);
  });

  // Raw Uint8Arrays reaching a bytea column over PostgREST are stored as the JSON text of an
  // index-keyed object. The row builders hex-encode; nothing else may feed these inserts.
  it('writes bytea columns only through the row builders', () => {
    const src = readFileSync('components/vault-app.tsx', 'utf8');
    const builders: Record<string, string> = {
      products: 'productInsertRow',
      secrets: 'secretInsertRow',
    };
    for (const [table, builder] of Object.entries(builders)) {
      const args = [
        ...src.matchAll(new RegExp(`from\\('${table}'\\)\\.insert\\(\\s*(\\w+)`, 'g')),
      ].map((m) => m[1]);
      expect(args.length, table).toBeGreaterThan(0);
      expect(new Set(args), table).toEqual(new Set([builder]));
    }
  });

  it('keystore module does not write localStorage', () => {
    const src = readFileSync('services/vault/src/keystore.ts', 'utf8');
    expect(src).not.toMatch(/localStorage\.setItem/);
    expect(src).not.toMatch(/sessionStorage\.setItem/);
    expect(src).not.toMatch(/indexedDB/);
  });

  it('decrypts secrets only in a client component', () => {
    const page = readFileSync('app/(app)/vault/page.tsx', 'utf8');
    expect(page).not.toMatch(/openSecretValue/);
    expect(page).not.toMatch(/from\('secrets'\)/);
    const app = readFileSync('components/vault-app.tsx', 'utf8');
    expect(app.startsWith("'use client'")).toBe(true);
    expect(app).toContain('openSecretValue');
  });

  it('rotates wraps before the GoTrue password', () => {
    const src = readFileSync('services/vault/src/password-change.ts', 'utf8');
    const rotate = src.indexOf('await input.rotateWrapped');
    const auth = src.indexOf('await input.updateAuthPassword');
    expect(rotate).toBeGreaterThan(0);
    expect(auth).toBeGreaterThan(rotate);
  });
});
