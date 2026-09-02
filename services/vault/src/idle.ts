import { IDLE_LOCK_MS } from './timing';
import { isUnlocked, lockKeys } from './keystore';

let timer: ReturnType<typeof setTimeout> | null = null;
let attached = false;

function bump(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    if (isUnlocked()) {
      void lockKeys();
    }
  }, IDLE_LOCK_MS);
}

function onActivity(): void {
  if (!isUnlocked()) return;
  bump();
}

export function startIdleLock(): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  if (!attached) {
    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('keydown', onActivity);
    attached = true;
  }
  bump();
  return () => {
    if (timer) clearTimeout(timer);
    timer = null;
    window.removeEventListener('pointerdown', onActivity);
    window.removeEventListener('keydown', onActivity);
    attached = false;
  };
}
