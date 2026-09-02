import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bannedVoiceHits } from '../lib/brand/voice';

const surfaces = [
  'app/page.tsx',
  'app/(app)/vault/page.tsx',
  'app/s/[token]/page.tsx',
  'app/not-found.tsx',
  'components/product-preview.tsx',
  'components/vault-composer.tsx',
  'components/countdown-ring.tsx',
  'components/site-footer.tsx',
  'components/site-header.tsx',
  'components/hero-stage.tsx',
  'lib/brand/hero-copy.ts',
];

const fillAsText = /text-(signal|sealed|exposed)(?!-ink)\b/;

describe('brand voice eval', () => {
  it('keeps marketing and product shells free of banned claims', () => {
    const hits = surfaces.flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return bannedVoiceHits(text).map((phrase) => `${file}: ${phrase}`);
    });
    expect(hits).toEqual([]);
  });

  it('uses ink tokens for status type, not fill accents', () => {
    const hits = surfaces.flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return fillAsText.test(text) ? [file] : [];
    });
    expect(hits).toEqual([]);
  });
});
