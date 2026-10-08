import { describe, expect, it } from 'vitest';
import * as content from './landing-content';
import {
  CLAUDE,
  FAQ,
  GUARANTEE,
  HOW,
  LIMITS,
  LIVE_CAPABILITIES,
  LIVE_STRIP,
  NEXT_CAPABILITIES,
} from './landing-content';
import { HERO_BODY, HERO_EYEBROW, HERO_HEADLINE } from './hero-copy';
import { EM_DASH, bannedVoiceHits } from './voice';

/** Every string reachable from the landing copy, hero lines included. */
function allStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(allStrings);
  return [];
}

const copy = [...allStrings(content), HERO_EYEBROW, HERO_HEADLINE, HERO_BODY];

describe('landing capability ledger', () => {
  it('pins Live to exactly what ships today', () => {
    expect([...LIVE_CAPABILITIES]).toEqual([
      'signup',
      'recovery-kit',
      'client-side-encryption',
      'masked-reveal',
      'idle-lock',
      'password-change',
    ]);
  });

  it('pins Next to exactly what is designed and not shipped', () => {
    expect([...NEXT_CAPABILITIES]).toEqual([
      'share-links',
      'recipient-verification',
      'open-notifications',
      'revocation',
      'claude-interface',
    ]);
  });

  it('labels each how-it-works step with the status of its capability', () => {
    for (const step of HOW.steps) {
      const live = (LIVE_CAPABILITIES as readonly string[]).includes(step.capability);
      expect(step.status, step.id).toBe(live ? 'live' : 'next');
    }
    expect(HOW.steps.map((s) => [s.name, s.status])).toEqual([
      ['Pick', 'live'],
      ['Reveal', 'live'],
      ['Send', 'next'],
      ['Watch', 'next'],
    ]);
  });

  it('labels the Claude interface as Next', () => {
    expect(CLAUDE.status).toBe('next');
    expect(NEXT_CAPABILITIES).toContain(CLAUDE.capability);
  });

  it('labels the share-revocation limit as Next', () => {
    const revoke = LIMITS.items.find((item) => /revok/i.test(item.title));
    expect(revoke?.status).toBe('next');
  });

  it('says Next wherever an FAQ answer describes sharing or Claude', () => {
    for (const item of FAQ.items) {
      if (/share link|Claude interface/i.test(item.a)) {
        expect(item.a, item.q).toMatch(/\bNext\b/);
      }
    }
  });
});

describe('landing voice and claims', () => {
  it('passes the banned-voice gate', () => {
    expect(copy.flatMap(bannedVoiceHits)).toEqual([]);
  });

  it('uses no em dashes', () => {
    expect(copy.filter((line) => line.includes(EM_DASH))).toEqual([]);
  });

  it('never claims clipboard clearing, which has a known bug', () => {
    expect(copy.filter((line) => /clipboard/i.test(line))).toEqual([]);
  });

  it('claims no region, customer count, certification or uptime', () => {
    const banned = /\bregion\b|customers?\b|SOC ?2|ISO ?27001|HIPAA|GDPR|certified|uptime|99\.9/i;
    expect(copy.filter((line) => banned.test(line))).toEqual([]);
  });

  it('avoids the egress phrasings the test does not support', () => {
    expect(copy.filter((line) => /every request|any encoding/i.test(line))).toEqual([]);
  });

  it('never uses unlock as a value verb, and has no padlock', () => {
    // "An unlocked laptop" is the literal adjective from the threat model; the verb is banned.
    expect(copy.filter((line) => /\bunlock(?!ed\b)/i.test(line))).toEqual([]);
    expect(copy.filter((line) => /padlock|\u{1F512}/iu.test(line))).toEqual([]);
  });

  it('states the key-derivation parameters exactly, once', () => {
    const kdf = GUARANTEE.steps.find((step) => step.id === 'argon2id');
    expect(kdf?.detail).toBe('64 MiB, 3 iterations, parallelism 1, in a Web Worker');
    expect(copy.filter((line) => /64 MiB/.test(line))).toHaveLength(1);
  });

  it('uses typographic apostrophes in prose', () => {
    expect(copy.filter((line) => /[A-Za-z]'[A-Za-z]/.test(line))).toEqual([]);
  });

  it('lists only Live capabilities in the Live strip', () => {
    expect([...LIVE_STRIP]).toEqual([
      'Re-masks after 30s',
      'Locks after 15 min idle',
      '24-word recovery kit',
      'No third-party scripts on vault pages',
    ]);
  });

  it('opens the Claude section by saying it is Next', () => {
    expect(CLAUDE.lead.startsWith('This part is Next, not live. When it ships,')).toBe(true);
  });

  it('keeps the demo secret outside every real key format', () => {
    expect(content.DEMO_SECRET).not.toMatch(/sk_(live|test)_[A-Za-z0-9]{10,}/);
  });
});
