import { describe, expect, it } from 'vitest';
import { HERO_BODY, HERO_EYEBROW, HERO_HEADLINE } from './hero-copy';
import { bannedVoiceHits } from './voice';

describe('hero copy', () => {
  it('leads with the verb loop, not a category definition', () => {
    expect(HERO_HEADLINE.join(' ')).toBe('Ask for it. Send it. Watch it expire.');
  });

  it('keeps the architecture claim in the body, above the fold', () => {
    expect(HERO_BODY).toMatch(/We cannot read your secrets/);
    expect(HERO_BODY).not.toMatch(/AI-powered/i);
  });

  it('keeps the name line as the eyebrow', () => {
    expect(HERO_EYEBROW).toBe('Your secrets, in the light.');
  });

  it('passes the banned-voice gate', () => {
    const blob = `${HERO_EYEBROW} ${HERO_HEADLINE.join(' ')} ${HERO_BODY}`;
    expect(bannedVoiceHits(blob)).toEqual([]);
  });
});
