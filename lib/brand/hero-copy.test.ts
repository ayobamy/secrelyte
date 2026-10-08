import { describe, expect, it } from 'vitest';
import { HERO_BODY, HERO_EYEBROW, HERO_HEADLINE } from './hero-copy';
import { bannedVoiceHits } from './voice';

describe('hero copy', () => {
  it('leads with the guarantee as the headline', () => {
    expect(HERO_HEADLINE).toBe('The secrets manager that can’t read your secrets.');
  });

  it('backs the guarantee with the mechanism in the body, above the fold', () => {
    expect(HERO_BODY).toMatch(/password never leaves your browser/);
    expect(HERO_BODY).toMatch(/Argon2id/);
    expect(HERO_BODY).toMatch(/ciphertext it cannot open/);
  });

  it('keeps the name line as the eyebrow', () => {
    expect(HERO_EYEBROW).toBe('Your secrets, in the light.');
  });

  it('never leads with AI', () => {
    const blob = `${HERO_EYEBROW} ${HERO_HEADLINE} ${HERO_BODY}`;
    expect(blob).not.toMatch(/\bAI\b|Claude|model|LLM/i);
  });

  it('passes the banned-voice gate and uses no em dashes', () => {
    const blob = `${HERO_EYEBROW} ${HERO_HEADLINE} ${HERO_BODY}`;
    expect(bannedVoiceHits(blob)).toEqual([]);
    expect(blob).not.toContain('—');
  });
});
