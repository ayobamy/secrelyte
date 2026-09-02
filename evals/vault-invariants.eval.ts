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
