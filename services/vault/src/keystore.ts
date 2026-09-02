import { zeroize, type VK, type X25519SecretKey } from '@/services/crypto';

let vaultKey: VK | null = null;
let secretKey: X25519SecretKey | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

export function subscribeUnlocked(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function isUnlocked(): boolean {
  return vaultKey !== null && secretKey !== null;
}

export function getVaultKey(): VK {
  if (!vaultKey) {
    throw new Error('LOCKED');
  }
  return vaultKey;
}

export function getSecretKey(): X25519SecretKey {
  if (!secretKey) {
    throw new Error('LOCKED');
  }
  return secretKey;
}

export function unlockKeys(vk: VK, sk: X25519SecretKey): void {
  vaultKey = vk;
  secretKey = sk;
  emit();
}

export async function lockKeys(): Promise<void> {
  if (vaultKey) await zeroize(vaultKey);
  if (secretKey) await zeroize(secretKey);
  vaultKey = null;
  secretKey = null;
  emit();
}

export function assertKeysAbsentFromWebStorage(): void {
  if (typeof localStorage === 'undefined') return;
  const dump = `${JSON.stringify(localStorage)} ${JSON.stringify(sessionStorage)}`;
  if (dump.includes('__brand') || dump.includes('wrapped_vault_key')) {
    throw new Error('keystore leaked into web storage');
  }
}
