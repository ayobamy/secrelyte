import { AAD, generateDek, unwrapDek, wrapDek, zeroize, type DEK } from '@/services/crypto';
import { bytesFromWire, bytesToEnvelope, envelopeToBytes } from './envelope';
import { getVaultKey } from './keystore';

export async function wrapNewProductDek(
  productId: string,
): Promise<{ dek: DEK; wrapped: Uint8Array }> {
  const dek = await generateDek();
  const env = await wrapDek(getVaultKey(), dek, productId);
  return { dek, wrapped: await envelopeToBytes(env) };
}

export async function openProductDek(productId: string, wrapped: unknown): Promise<DEK> {
  const env = await bytesToEnvelope(bytesFromWire(wrapped), AAD.wrapDek(productId));
  return unwrapDek(getVaultKey(), env, productId);
}

export async function discardDek(dek: DEK): Promise<void> {
  await zeroize(dek);
}
