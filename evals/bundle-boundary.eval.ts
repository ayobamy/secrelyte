import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * scripts/check-bundle-secrets.sh proves this at build time by grepping .next/static.
 * This eval proves it at source level in milliseconds, so the boundary breaks in the gate
 * lane instead of after a full build.
 *
 * The failure it exists to catch: a client module importing a module that names a server
 * secret. lib/env.ts once held both the client and the server schema, so every client chunk
 * carried the literal `sb_secret_` and check:bundle went red.
 */

const ROOT = path.resolve(__dirname, '..');
const SERVER_SECRET_NAMES = [/sb_secret_/, /service_role/];
const SOURCE_DIRS = ['app', 'components', 'lib', 'services', 'contracts'];
const EXTENSIONS = ['.ts', '.tsx'];

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkFiles(full));
    } else if (EXTENSIONS.includes(path.extname(entry))) {
      out.push(full);
    }
  }
  return out;
}

function allSourceFiles(): string[] {
  return SOURCE_DIRS.flatMap((dir) => walkFiles(path.join(ROOT, dir)));
}

/** Resolves an import specifier to an on-disk module, or null when it is a package. */
function resolveLocal(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) {
    base = path.join(ROOT, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    base = path.resolve(path.dirname(fromFile), specifier);
  } else {
    return null;
  }
  const candidates = [
    base,
    ...EXTENSIONS.map((ext) => `${base}${ext}`),
    ...EXTENSIONS.map((ext) => path.join(base, `index${ext}`)),
  ];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // Not this candidate. Keep looking.
    }
  }
  return null;
}

function importSpecifiers(src: string): string[] {
  const out: string[] = [];
  for (const match of src.matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g)) {
    out.push(match[1]!);
  }
  return out;
}

function isClientEntry(file: string): boolean {
  const src = readFileSync(file, 'utf8');
  return src.startsWith("'use client'") || src.startsWith('"use client"');
}

/** Every local module reachable from a `'use client'` entry, entries included. */
function clientReachableModules(): Map<string, string[]> {
  const entries = allSourceFiles().filter(isClientEntry);
  const seen = new Map<string, string[]>();
  const queue: Array<{ file: string; trail: string[] }> = entries.map((file) => ({
    file,
    trail: [path.relative(ROOT, file)],
  }));

  while (queue.length > 0) {
    const { file, trail } = queue.shift()!;
    if (seen.has(file)) continue;
    seen.set(file, trail);
    const src = readFileSync(file, 'utf8');
    for (const specifier of importSpecifiers(src)) {
      const resolved = resolveLocal(specifier, file);
      if (resolved && !seen.has(resolved)) {
        queue.push({ file: resolved, trail: [...trail, path.relative(ROOT, resolved)] });
      }
    }
  }
  return seen;
}

describe('bundle boundary eval', () => {
  it('finds the client entries it is meant to guard', () => {
    const reachable = clientReachableModules();
    const entries = [...reachable.keys()].map((f) => path.relative(ROOT, f));
    expect(entries).toContain('components/vault-app.tsx');
    expect(entries).toContain('components/auth-forms.tsx');
    // Proof the walk is transitive, not just the entry list.
    expect(entries).toContain('lib/env.ts');
  });

  it('names no server secret in any client-reachable module', () => {
    const violations: string[] = [];
    for (const [file, trail] of clientReachableModules()) {
      const src = readFileSync(file, 'utf8');
      for (const pattern of SERVER_SECRET_NAMES) {
        if (pattern.test(src)) {
          violations.push(
            `${path.relative(ROOT, file)} matches ${pattern} via ${trail.join(' -> ')}`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps the server env module out of every client-reachable graph', () => {
    const reachable = [...clientReachableModules().keys()].map((f) => path.relative(ROOT, f));
    expect(reachable).not.toContain('lib/env.server.ts');
  });

  it('guards every server-secret module with server-only', () => {
    for (const file of allSourceFiles()) {
      const src = readFileSync(file, 'utf8');
      if (file.endsWith('.test.ts') || file.endsWith('.eval.ts')) continue;
      const namesSecret = SERVER_SECRET_NAMES.some((pattern) => pattern.test(src));
      if (!namesSecret) continue;
      expect(
        src.startsWith("import 'server-only'"),
        `${path.relative(ROOT, file)} names a server secret without the server-only guard`,
      ).toBe(true);
    }
  });
});
