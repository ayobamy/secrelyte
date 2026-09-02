import { AAD, recoveryKeyFromWords, unwrapVaultKeyFromRecovery, zeroize } from '@/services/crypto';
import { bytesFromWire, bytesToEnvelope } from './envelope';
import { getVaultKey, isUnlocked } from './keystore';

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i += 1) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

export async function phraseMatchesCurrentVault(
  phrase: string,
  recoveryWrappedVaultKey: unknown,
): Promise<boolean> {
  if (!isUnlocked()) return false;
  let rk: ReturnType<typeof recoveryKeyFromWords> | null = null;
  try {
    rk = recoveryKeyFromWords(phrase.trim().toLowerCase().replace(/\s+/g, ' '));
    const env = await bytesToEnvelope(bytesFromWire(recoveryWrappedVaultKey), AAD.wrapVkRk);
    const opened = await unwrapVaultKeyFromRecovery(rk, env);
    const ok = bytesEqual(opened, getVaultKey());
    await zeroize(opened);
    return ok;
  } catch {
    return false;
  } finally {
    if (rk) await zeroize(rk);
  }
}
