import { getSodium } from './sodium';

export async function zeroize(...keys: Array<Uint8Array | null | undefined>): Promise<void> {
  const sodium = await getSodium();
  for (const key of keys) {
    if (key) {
      sodium.memzero(key);
    }
  }
}

export async function withKey<K extends Uint8Array, R>(
  key: K,
  fn: (k: K) => Promise<R>,
): Promise<R> {
  try {
    return await fn(key);
  } finally {
    await zeroize(key);
  }
}
