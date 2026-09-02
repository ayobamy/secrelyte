import { describe, expect, it } from 'vitest';
import { REVEAL_MS, formatRevealSeconds, revealRatio, revealRemaining } from './reveal-timer';

describe('revealRemaining', () => {
  it('starts at the full window', () => {
    expect(revealRemaining(1_000, 1_000)).toBe(REVEAL_MS);
  });

  it('hits zero at the remask instant and stays there', () => {
    expect(revealRemaining(0, REVEAL_MS)).toBe(0);
    expect(revealRemaining(0, REVEAL_MS + 4_000)).toBe(0);
  });
});

describe('revealRatio', () => {
  it('is 1 at the start and 0 when remasked', () => {
    expect(revealRatio(REVEAL_MS)).toBe(1);
    expect(revealRatio(0)).toBe(0);
  });
});

describe('formatRevealSeconds', () => {
  it('ceils partial seconds so the last second is visible', () => {
    expect(formatRevealSeconds(30_000)).toBe('30s');
    expect(formatRevealSeconds(1)).toBe('1s');
    expect(formatRevealSeconds(0)).toBe('0s');
  });
});
