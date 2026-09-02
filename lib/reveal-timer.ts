export const REVEAL_MS = 30_000;

export function revealRemaining(startedAt: number, now: number, duration = REVEAL_MS): number {
  return Math.max(0, duration - (now - startedAt));
}

export function revealRatio(remainingMs: number, duration = REVEAL_MS): number {
  if (duration <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, remainingMs / duration));
}

export function formatRevealSeconds(remainingMs: number): string {
  return `${Math.max(0, Math.ceil(remainingMs / 1000))}s`;
}
