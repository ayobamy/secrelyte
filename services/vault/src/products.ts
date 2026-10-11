import {
  AAD,
  generateDek,
  unwrapDek,
  withKey,
  wrapDek,
  zeroize,
  type DEK,
} from '@/services/crypto';
import { bytesFromWire, bytesToEnvelope, envelopeToBytes } from './envelope';
import { getVaultKey } from './keystore';

const JSON_OBJECT_PREFIX = [0x7b, 0x22, 0x30, 0x22, 0x3a]; // {"0":

/**
 * Earlier builds handed supabase-js a raw Uint8Array for the bytea column, which it stores as
 * the JSON text of an index-keyed object (`{"0":62,"1":218,...}`). The wrap is intact inside.
 * This returns those inner bytes, or null when the input is not exactly that shape.
 *
 * Decoding is only a change of representation. The result still has to authenticate in
 * openProductDek, so a server that forges this shape gets a tamper error like any other forged
 * wrap. Migration 0014 rewrites stored rows; this path covers rows written before it ran, or by
 * a tab still running an old build.
 */
export function legacyJsonWrapBytes(bytes: Uint8Array): Uint8Array | null {
  if (!JSON_OBJECT_PREFIX.every((b, i) => bytes[i] === b)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    // Not UTF-8 or not JSON: not this shape. The caller treats it as an ordinary wrap.
    return null;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const entries = Object.entries(parsed);
  const valid =
    entries.length > 0 &&
    entries.every(
      ([key, value], i) =>
        key === String(i) && Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 255,
    );
  return valid ? Uint8Array.from(entries, ([, value]) => Number(value)) : null;
}

export async function wrapNewProductDek(
  productId: string,
): Promise<{ dek: DEK; wrapped: Uint8Array }> {
  // Fail fast when locked, so no DEK is ever created for a locked vault.
  getVaultKey();
  const dek = await generateDek();
  try {
    // Read again after the await: a lock in between zeroes the vault key in place, and wrapping
    // under a zeroed key would store a product nobody can open.
    const env = await wrapDek(getVaultKey(), dek, productId);
    return { dek, wrapped: await envelopeToBytes(env) };
  } catch (err) {
    await zeroize(dek);
    throw err;
  }
}

export async function openProductDek(productId: string, wrapped: unknown): Promise<DEK> {
  const stored = bytesFromWire(wrapped);
  const bytes = legacyJsonWrapBytes(stored) ?? stored;
  const env = await bytesToEnvelope(bytes, AAD.wrapDek(productId));
  return unwrapDek(getVaultKey(), env, productId);
}

/** The wrapped DEK for a new product. The DEK itself is zeroed before this returns. */
export async function createProductWrap(productId: string): Promise<Uint8Array> {
  const { dek, wrapped } = await wrapNewProductDek(productId);
  await zeroize(dek);
  return wrapped;
}

/** Opens a product DEK, runs `fn` with it, and zeroes it on every path. */
export async function withProductDek<R>(
  productId: string,
  wrapped: unknown,
  fn: (dek: DEK) => Promise<R>,
): Promise<R> {
  return withKey(await openProductDek(productId, wrapped), fn);
}

export async function discardDek(dek: DEK): Promise<void> {
  await zeroize(dek);
}
