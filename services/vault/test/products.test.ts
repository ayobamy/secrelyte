import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as crypto from '@/services/crypto';
import { hexToBytes } from '../src/envelope';
import {
  bytesFromWire,
  legacyJsonWrapBytes,
  lockKeys,
  openProductDek,
  unlockKeys,
  createProductWrap,
  withProductDek,
  wrapNewProductDek,
} from '@/services/vault';

/**
 * The real crypto, with three seams: generateDek records the DEK it hands out and can run a
 * step while it is in flight, and wrapDek can be made to fail. That is what lets these tests
 * see a DEK that never got zeroed, and a lock that lands mid-creation.
 */
const seam = vi.hoisted(() => ({
  issued: [] as Uint8Array[],
  failWrap: false,
  duringGenerate: null as null | (() => Promise<void>),
}));

vi.mock('@/services/crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/crypto')>();
  return {
    ...actual,
    generateDek: vi.fn(async () => {
      const dek = await actual.generateDek();
      seam.issued.push(dek);
      await seam.duringGenerate?.();
      return dek;
    }),
    wrapDek: vi.fn(async (...args: Parameters<typeof actual.wrapDek>) => {
      if (seam.failWrap) throw new Error('wrap failed');
      return actual.wrapDek(...args);
    }),
  };
});

const PRODUCT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const isZeroed = (bytes: Uint8Array) => bytes.every((b) => b === 0);

async function unlock(): Promise<void> {
  const { secretKey } = await crypto.generateKeypair();
  unlockKeys(await crypto.generateVaultKey(), secretKey);
}

beforeEach(() => {
  seam.issued.length = 0;
  seam.failWrap = false;
  seam.duringGenerate = null;
  vi.mocked(crypto.generateDek).mockClear();
  vi.mocked(crypto.wrapDek).mockClear();
});

afterEach(async () => {
  await lockKeys();
});

describe('wrapNewProductDek', () => {
  it('creates no DEK at all when the vault is locked', async () => {
    await lockKeys();
    await expect(wrapNewProductDek(PRODUCT_ID)).rejects.toThrow('LOCKED');
    expect(crypto.generateDek).not.toHaveBeenCalled();
  });

  it('zeroes the DEK when wrapping fails', async () => {
    await unlock();
    seam.failWrap = true;
    await expect(wrapNewProductDek(PRODUCT_ID)).rejects.toThrow('wrap failed');
    expect(seam.issued).toHaveLength(1);
    expect(isZeroed(seam.issued[0]!)).toBe(true);
  });
});

// lockKeys zeroes the vault key in place. A key read before generateDek's await would wrap
// the new DEK under all zeros: a product nobody can open, stored as if it were fine.
it('a lock that lands while the DEK is being made fails the wrap and zeroes the DEK', async () => {
  await unlock();
  seam.duringGenerate = () => lockKeys();
  await expect(wrapNewProductDek(PRODUCT_ID)).rejects.toThrow('LOCKED');
  expect(seam.issued).toHaveLength(1);
  expect(isZeroed(seam.issued[0]!)).toBe(true);
  expect(crypto.wrapDek).not.toHaveBeenCalled();
});

describe('createProductWrap', () => {
  it('returns a wrap that opens, and zeroes the DEK before returning', async () => {
    await unlock();
    const wrapped = await createProductWrap(PRODUCT_ID);
    expect(seam.issued).toHaveLength(1);
    expect(isZeroed(seam.issued[0]!)).toBe(true);
    await withProductDek(PRODUCT_ID, wrapped, async (dek) => {
      expect(isZeroed(dek)).toBe(false);
    });
  });
});

describe('withProductDek', () => {
  it('opens the stored wrap to the same DEK, then zeroes it, on success and on throw', async () => {
    await unlock();
    const { dek, wrapped } = await wrapNewProductDek(PRODUCT_ID);
    const original = Uint8Array.from(dek);

    let seen: Uint8Array | null = null;
    await withProductDek(PRODUCT_ID, wrapped, async (opened) => {
      seen = opened;
      expect(Array.from(opened)).toEqual(Array.from(original));
    });
    expect(isZeroed(seen!)).toBe(true);

    await expect(
      withProductDek(PRODUCT_ID, wrapped, async (opened) => {
        seen = opened;
        throw new Error('seal failed');
      }),
    ).rejects.toThrow('seal failed');
    expect(isZeroed(seen!)).toBe(true);
  });
});

describe('legacy JSON wraps', () => {
  // What supabase-js wrote for a raw Uint8Array in a bytea column.
  const asLegacy = (bytes: Uint8Array) =>
    new TextEncoder().encode(JSON.stringify(Object.fromEntries(bytes.entries())));

  it('decodes the index-keyed JSON form to its exact bytes, and nothing else', async () => {
    await unlock();
    const { wrapped } = await wrapNewProductDek(PRODUCT_ID);
    expect(Array.from(legacyJsonWrapBytes(asLegacy(wrapped))!)).toEqual(Array.from(wrapped));
    expect(legacyJsonWrapBytes(wrapped)).toBeNull();
    // The 5-byte prefix alone is not enough.
    expect(legacyJsonWrapBytes(new TextEncoder().encode('{"0":7, not json'))).toBeNull();
    // Keys must run 0, 1, 2 ... and values must be bytes.
    expect(legacyJsonWrapBytes(new TextEncoder().encode('{"0":1,"2":3}'))).toBeNull();
    expect(legacyJsonWrapBytes(new TextEncoder().encode('{"0":256}'))).toBeNull();
  });

  it('opens a real legacy wrap to the same DEK, without waiting for the migration', async () => {
    await unlock();
    const { dek, wrapped } = await wrapNewProductDek(PRODUCT_ID);
    const original = Array.from(dek);
    await withProductDek(PRODUCT_ID, asLegacy(wrapped), async (opened) => {
      expect(Array.from(opened)).toEqual(original);
    });
  });

  // A server that controls the database can write anything. Writing the legacy shape must not
  // let it skip authentication, or turn a tamper alarm into reassurance.
  it('fails a forged legacy-shaped wrap as tampered', async () => {
    await unlock();
    // A wrap-sized blob: 24 nonce bytes plus a 48-byte ciphertext, all random.
    const forged = asLegacy(globalThis.crypto.getRandomValues(new Uint8Array(72)));
    await expect(openProductDek(PRODUCT_ID, forged)).rejects.toBeInstanceOf(
      crypto.AuthenticationError,
    );
  });
});

// The server is outside the trust boundary, so bytes that are not even an envelope must raise
// the same alarm as a forged one, not a generic failure the server could choose instead.
describe('stored bytes that are not an envelope', () => {
  it('fail as tampered, never as a generic error', async () => {
    await unlock();
    for (const wrapped of ['\\x00ff', '\\x' + 'zz'.repeat(72), '\\x0', 'not bytes', 42, null]) {
      await expect(openProductDek(PRODUCT_ID, wrapped), String(wrapped)).rejects.toBeInstanceOf(
        crypto.AuthenticationError,
      );
    }
  });

  it('never reads non-hex characters as zero bytes', () => {
    expect(() => hexToBytes('\\x00zz')).toThrow(crypto.AuthenticationError);
    expect(() => bytesFromWire('\\xg0')).toThrow(crypto.AuthenticationError);
    expect(Array.from(hexToBytes('\\x0aFF'))).toEqual([0x0a, 0xff]);
  });
});
