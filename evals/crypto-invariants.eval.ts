import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { AAD, ARGON2ID, KDF, OWASP_MIN_MEMORY_KIB } from '@/services/crypto';
import vectors from '../services/crypto/test/vectors.json';

describe('crypto invariants eval', () => {
  it('keeps every frozen vector concrete', () => {
    const raw = readFileSync('services/crypto/test/vectors.json', 'utf8');
    expect(raw.includes('TBD')).toBe(false);
    expect(vectors.kdf_salt.expected_salt_b64url.length).toBeGreaterThan(8);
    expect(vectors.master_key.expected_mk_b64url.length).toBeGreaterThan(8);
    expect(vectors.branch_separation.expected_auth_b64url).not.toBe(
      vectors.branch_separation.expected_mek_b64url,
    );
    expect(vectors.aead_roundtrip.expected_ct_b64url.length).toBeGreaterThan(8);
  });

  it('pins Argon2id and HKDF info strings to the spec', () => {
    expect(ARGON2ID).toEqual({ m: 65536, t: 3, p: 1, v: 1 });
    expect(ARGON2ID.m).toBeGreaterThan(OWASP_MIN_MEMORY_KIB);
    expect(KDF.saltInfo).toBe('secrelyte:salt:v1');
    expect(KDF.authInfo).toBe('secrelyte:auth:v1');
    expect(KDF.mekInfo).toBe('secrelyte:mek:v1');
    expect(KDF.recoveryInfo).toBe('secrelyte:recovery:v1');
    expect(AAD.wrapVk).toBe('wrap:vk:v1');
    expect(AAD.wrapSk).toBe('wrap:sk:v1');
  });

  it('keeps the crypto boundary script green', () => {
    const out = execFileSync('bash', ['scripts/check-crypto-boundary.sh'], { encoding: 'utf8' });
    expect(out).toContain('crypto boundary OK');
  });

  it('allowlists frozen vectors so gitleaks does not treat fixtures as live keys', () => {
    const toml = readFileSync('gitleaks.toml', 'utf8');
    expect(toml).toContain(String.raw`^services/crypto/test/vectors\.json$`);
    expect(toml).toContain(vectors.aead_roundtrip.plaintext);
  });
});
