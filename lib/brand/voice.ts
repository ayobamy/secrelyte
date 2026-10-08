/**
 * Phrases the brand never uses. The first group is the brand direction's own ban list; the
 * second is marketing filler that says nothing a developer can check. "Unlock" stays legal:
 * it is the literal name of the vault action, and only its use as a value verb is banned,
 * which a substring list cannot tell apart, so reviews and the landing tests cover it.
 */
export const BANNED_VOICE = [
  'AI-powered',
  'military-grade',
  'bank-grade',
  'unhackable',
  '100% secure',
  'delve',
  'crucial',
  'robust',
  'comprehensive',
  'seamless',
  'cutting-edge',
  'leverage',
  'empower',
  'revolutionize',
  'revolutionise',
] as const;

export const EM_DASH = '—';

export function bannedVoiceHits(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_VOICE.filter((phrase) => lower.includes(phrase.toLowerCase()));
}
