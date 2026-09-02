import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationsDir = 'supabase/migrations';
const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

function read(name: string): string {
  return readFileSync(`${migrationsDir}/${name}`, 'utf8');
}

describe('schema invariants eval', () => {
  it('ships every numbered migration from the spec', () => {
    expect(files).toEqual([
      '0001_extensions_and_lockdown.sql',
      '0002_user_keys.sql',
      '0003_products.sql',
      '0004_secrets.sql',
      '0005_shared_links.sql',
      '0006_share_verifications.sql',
      '0007_audit_log.sql',
      '0008_consume_share.sql',
      '0009_atomic_password_rotation.sql',
      '0010_cleanup_jobs.sql',
      '0011_vault_key_rpcs.sql',
      '0012_service_role_user_keys.sql',
      '0013_store_signup_keys.sql',
    ]);
  });

  it('never installs pgsodium', () => {
    for (const name of files) {
      expect(read(name)).not.toMatch(/CREATE EXTENSION(?:\s+IF NOT EXISTS)?\s+pgsodium/i);
    }
  });

  it('enables and forces RLS on every public table', () => {
    const sql = files.map(read).join('\n');
    const tables = [...sql.matchAll(/CREATE TABLE public\.(\w+)/g)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThanOrEqual(6);
    for (const table of tables) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`);
    }
  });

  it('pins search_path on SECURITY DEFINER functions', () => {
    const sql = files.map(read).join('\n');
    const definers = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)/g)].map(
      (m) => m[1],
    );
    expect(definers).toEqual(
      expect.arrayContaining([
        'consume_share',
        'rotate_wrapped_keys',
        'audit_immutable',
        'get_own_keys',
        'ack_recovery_kit',
        'kdf_params_for_email',
        'store_signup_keys',
      ]),
    );
    expect(sql).toContain("SECURITY DEFINER\nSET search_path = ''");
    expect(sql).toContain("LANGUAGE plpgsql SET search_path = '' AS $$");
  });

  it('keeps the OWASP Argon2id floor in chk_kdf', () => {
    expect(read('0002_user_keys.sql')).toContain("(kdf_params->>'m')::int >= 19456");
  });

  it('does not grant consume_share to anon or authenticated', () => {
    const sql = read('0008_consume_share.sql');
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.consume_share(uuid) FROM PUBLIC, anon, authenticated',
    );
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.consume_share(uuid) TO service_role');
  });
});
