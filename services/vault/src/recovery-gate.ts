import { AAD, recoveryKeyFromWords, unwrapVaultKeyFromRecovery, zeroize } from '@/services/crypto';
import { bytesEqual, bytesFromWire, bytesToEnvelope } from './envelope';
import { getVaultKey, isUnlocked } from './keystore';

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
