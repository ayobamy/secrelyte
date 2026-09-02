import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import { MIN_PASSWORD_LENGTH, MIN_ZXCVBN_SCORE } from './timing';

zxcvbnOptions.setOptions({
  dictionary: {
    ...zxcvbnCommon.dictionary,
  },
  graphs: zxcvbnCommon.adjacencyGraphs,
});

export function scorePassword(password: string): {
  score: number;
  ok: boolean;
  reason: string | null;
} {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      score: 0,
      ok: false,
      reason: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  const result = zxcvbn(password);
  if (result.score < MIN_ZXCVBN_SCORE) {
    return {
      score: result.score,
      ok: false,
      reason: 'Choose a stronger passphrase. Three unrelated words beats a short mix.',
    };
  }
  return { score: result.score, ok: true, reason: null };
}
