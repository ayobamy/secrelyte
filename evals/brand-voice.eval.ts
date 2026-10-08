import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EM_DASH, bannedVoiceHits } from '../lib/brand/voice';

const landingComponents = readdirSync('components/landing')
  .filter((file) => file.endsWith('.tsx'))
  .map((file) => `components/landing/${file}`);

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
  'lib/brand/landing-content.ts',
  ...landingComponents,
];

const landing = [
  'app/page.tsx',
  'components/product-preview.tsx',
  'components/site-footer.tsx',
  'components/site-header.tsx',
  'lib/brand/hero-copy.ts',
  'lib/brand/landing-content.ts',
  ...landingComponents,
];

const fillAsText = /text-(signal|sealed|exposed)(?!-ink)\b/;

function tsxUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return tsxUnder(full);
    return full.endsWith('.tsx') ? [full] : [];
  });
}

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

  it('keeps the landing page free of em dashes and clipboard claims', () => {
    const hits = landing.flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      const found: string[] = [];
      if (text.includes(EM_DASH)) found.push(`${file}: em dash`);
      if (/clipboard/i.test(text)) found.push(`${file}: clipboard claim`);
      return found;
    });
    expect(hits).toEqual([]);
  });

  // The production CSP sends style-src without 'unsafe-inline', so a JSX style attribute is
  // blocked in the browser and logs a violation. Classes and CSS only.
  it('never renders an inline style attribute', () => {
    const hits = [...tsxUnder('app'), ...tsxUnder('components')].filter((file) =>
      /\sstyle=\{/.test(readFileSync(file, 'utf8')),
    );
    expect(hits).toEqual([]);
  });
});
