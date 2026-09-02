export const BANNED_VOICE = [
  'AI-powered',
  'military-grade',
  'bank-grade',
  'unhackable',
  '100% secure',
] as const;

export function bannedVoiceHits(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_VOICE.filter((phrase) => lower.includes(phrase.toLowerCase()));
}
