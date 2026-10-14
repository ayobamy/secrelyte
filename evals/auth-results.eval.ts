import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * supabase-js answers a failed sign-in with `{ error }`; it does not throw. A sign-in whose
 * result is dropped therefore carries on as if it worked: signup once went on to the recovery
 * kit with no session, and every "Open the vault" after that failed. Every sign-in call's
 * result is bound and read.
 */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : sources(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('auth results eval', () => {
  it('binds the result of every sign-in call', () => {
    const dropped: string[] = [];
    let calls = 0;
    for (const file of ['app', 'components', 'lib', 'services'].flatMap(sources)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (!/\.signInWith\w*\(/.test(line)) return;
          calls += 1;
          if (!/=\s*(await\s+)?[\w.]+\.signInWith\w*\(/.test(line)) {
            dropped.push(`${file}:${index + 1}: ${line.trim()}`);
          }
        });
    }
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(dropped).toEqual([]);
  });
});
