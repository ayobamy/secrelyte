import { describe, expect, it } from 'vitest';
import { AuthenticationError, sodiumReady } from '@/services/crypto';
import {
  assembleSignupMaterial,
  bytesToPgHex,
  openProductDek,
  openSecretValue,
  productInsertRow,
  sealSecretValue,
  secretInsertRow,
  unlockKeys,
  wrapNewProductDek,
} from '@/services/vault';
import { hexToBytes } from '../src/envelope';

/**
 * The regression these lock down: the vault UI inserted raw Uint8Arrays into bytea columns.
 * Every product row stored `{"0":62,"1":218,...}` instead of its wrapped DEK, so every
 * secret insert threw on unwrap and nothing surfaced it. The older vault.test.ts passes the
 * raw array straight to openProductDek, which accepts a Uint8Array as-is, so it never crossed
 * the wire the real system always crosses.
 *
 * `throughPostgrest` models that wire: supabase-js JSON-encodes the body, PostgREST casts the
 * JSON value to bytea (a `\x` string as hex, anything else as the UTF-8 bytes of its JSON
 * text), and reads return bytea as a `\x` hex string. Checked against a real local Supabase
 * row: a raw 72-byte wrap came back as 613 bytes beginning `{"0":`.
 */
function throughPostgrest(value: unknown): string {
  const received: unknown = JSON.parse(JSON.stringify({ v: value })).v;
  const text = typeof received === 'string' ? received : JSON.stringify(received);
  const stored = text.startsWith('\\x') ? hexToBytes(text) : new TextEncoder().encode(text);
  return bytesToPgHex(stored);
}

const PRODUCT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SECRET_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

async function unlockedVault(): Promise<void> {
  await sodiumReady();
  const material = await assembleSignupMaterial(
    'rows@example.com',
    'correct-horse-battery-staple-orbit',
  );
  unlockKeys(material.vk, material.sk);
}

describe('the PostgREST wire model', () => {
  it('reproduces the corruption seen in the database for a raw array', async () => {
    await unlockedVault();
    const { wrapped } = await wrapNewProductDek(PRODUCT_ID);
    const wire = throughPostgrest(wrapped);
    const stored = new TextDecoder().decode(hexToBytes(wire));
    expect(stored.startsWith('{"0":')).toBe(true);
    expect(hexToBytes(wire).byteLength).toBeGreaterThan(wrapped.byteLength * 4);
  });

  it('passes a \\x hex literal through unchanged', () => {
    const bytes = Uint8Array.from([0x00, 0x3e, 0xda, 0xff]);
    expect(throughPostgrest(bytesToPgHex(bytes))).toBe('\\x003edaff');
  });
});

describe('product rows', () => {
  it('a raw wrapped DEK does not survive the wire', async () => {
    await unlockedVault();
    const { wrapped } = await wrapNewProductDek(PRODUCT_ID);
    await expect(openProductDek(PRODUCT_ID, throughPostgrest(wrapped))).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it('a productInsertRow survives the wire and still unwraps the same DEK', async () => {
    await unlockedVault();
    const { dek, wrapped } = await wrapNewProductDek(PRODUCT_ID);
    const row = productInsertRow({
      id: PRODUCT_ID,
      userId: USER_ID,
      name: 'Production',
      environment: 'production',
      wrappedDek: wrapped,
    });
    expect(row.wrapped_dek.startsWith('\\x')).toBe(true);

    const reopened = await openProductDek(PRODUCT_ID, throughPostgrest(row.wrapped_dek));
    // Same DEK means a secret sealed under the original opens under the reopened one.
    const sealed = await sealSecretValue({
      dek,
      productId: PRODUCT_ID,
      secretId: SECRET_ID,
      version: 1,
      value: 'sk_live_SENTINEL_ROWS',
    });
    await expect(
      openSecretValue({
        dek: reopened,
        productId: PRODUCT_ID,
        secretId: SECRET_ID,
        version: 1,
        ciphertext: sealed.ciphertext,
        nonce: sealed.nonce,
      }),
    ).resolves.toBe('sk_live_SENTINEL_ROWS');
  });

  it('maps every column', () => {
    const row = productInsertRow({
      id: PRODUCT_ID,
      userId: USER_ID,
      name: 'Production',
      environment: 'production',
      wrappedDek: Uint8Array.from([1, 2]),
    });
    expect(row).toEqual({
      id: PRODUCT_ID,
      user_id: USER_ID,
      name: 'Production',
      environment: 'production',
      wrapped_dek: '\\x0102',
    });
  });
});

describe('secret rows', () => {
  it('a secretInsertRow survives the wire and still decrypts', async () => {
    await unlockedVault();
    const { dek } = await wrapNewProductDek(PRODUCT_ID);
    const sealed = await sealSecretValue({
      dek,
      productId: PRODUCT_ID,
      secretId: SECRET_ID,
      version: 1,
      value: 'sk_live_SENTINEL_ROWS',
    });
    const row = secretInsertRow({
      id: SECRET_ID,
      productId: PRODUCT_ID,
      keyName: 'api_key',
      version: 1,
      ciphertext: sealed.ciphertext,
      nonce: sealed.nonce,
    });
    expect(row.ciphertext.startsWith('\\x')).toBe(true);
    expect(row.nonce.startsWith('\\x')).toBe(true);
    // Plaintext never reaches the row, in any encoding.
    expect(JSON.stringify(row)).not.toContain('SENTINEL');

    await expect(
      openSecretValue({
        dek,
        productId: PRODUCT_ID,
        secretId: SECRET_ID,
        version: 1,
        ciphertext: hexToBytes(throughPostgrest(row.ciphertext)),
        nonce: hexToBytes(throughPostgrest(row.nonce)),
      }),
    ).resolves.toBe('sk_live_SENTINEL_ROWS');
  });

  it('maps every column', () => {
    const row = secretInsertRow({
      id: SECRET_ID,
      productId: PRODUCT_ID,
      keyName: 'api_key',
      version: 3,
      ciphertext: Uint8Array.from([0xab]),
      nonce: Uint8Array.from([0xcd]),
    });
    expect(row).toEqual({
      id: SECRET_ID,
      product_id: PRODUCT_ID,
      key_name: 'api_key',
      version: 3,
      ciphertext: '\\xab',
      nonce: '\\xcd',
    });
  });
});
