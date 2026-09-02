export function pickChallengeIndices(
  wordCount: number,
  take: number,
  rand = Math.random,
): number[] {
  if (take > wordCount) {
    throw new RangeError('challenge longer than phrase');
  }
  const idx = Array.from({ length: wordCount }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = idx[i]!;
    idx[i] = idx[j]!;
    idx[j] = tmp;
  }
  return idx.slice(0, take).sort((a, b) => a - b);
}

export function wordsMatch(expected: string, actual: string): boolean {
  return expected.trim().toLowerCase() === actual.trim().toLowerCase();
}

export function verifyChallenge(
  words: string[],
  answers: { index: number; value: string }[],
): boolean {
  if (answers.length !== 3) return false;
  return answers.every((a) => wordsMatch(words[a.index] ?? '', a.value));
}
