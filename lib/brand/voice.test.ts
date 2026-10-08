import { describe, expect, it } from 'vitest';
import { bannedVoiceHits } from './voice';

describe('bannedVoiceHits', () => {
  it('flags AI-powered in hero copy', () => {
    expect(bannedVoiceHits('An AI-powered vault')).toEqual(['AI-powered']);
  });

  it('lets the architecture claim through', () => {
    expect(bannedVoiceHits('The secrets manager that cannot read your secrets.')).toEqual([]);
  });

  it('flags marketing filler regardless of case', () => {
    expect(bannedVoiceHits('A Seamless, ROBUST way to leverage keys')).toEqual([
      'robust',
      'seamless',
      'leverage',
    ]);
  });

  it('allows Unlock as the literal name of the vault action', () => {
    expect(bannedVoiceHits('Already have a vault? Unlock')).toEqual([]);
  });
});
