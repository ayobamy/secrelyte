import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every page renders per request (the CSP nonce in the root layout), and Next's default
 * prefetch fetches nothing ahead for such a route: a click on a plain <Link> waits on a full
 * server round trip. `prefetch` fetches the route when the link shows, so the click is instant.
 */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [full] : [];
  });
}

describe('navigation eval', () => {
  it('prefetches every internal <Link> in full', () => {
    const missing: string[] = [];
    let links = 0;
    for (const file of [...sources('app'), ...sources('components')]) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/<Link\b[^>]*>/g)) {
        links += 1;
        if (!/\bprefetch\b/.test(match[0])) missing.push(`${file}: ${match[0].slice(0, 60)}`);
      }
    }
    expect(links).toBeGreaterThan(10);
    expect(missing).toEqual([]);
  });
});
