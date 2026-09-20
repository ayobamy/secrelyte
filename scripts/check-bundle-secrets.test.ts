import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Regression tests for the "no secret key in the client bundle" gate.
 *
 * The bug these lock down: the gate used to grep the bare token `sb_secret_`, which
 * @supabase/supabase-js names in its own `isNewApiKey` prefix check. That made the gate red
 * on every build whether or not a secret leaked, and a gate that is always red stops being
 * read. Tightening it to match key VALUES had to keep every true positive, so each one has a
 * case below.
 *
 * Fake keys are assembled at runtime from fragments so no key-shaped literal exists in this
 * source file for a secret scanner or a reviewer to trip over.
 */

const SCRIPT = path.resolve(__dirname, 'check-bundle-secrets.sh');
const SECRET_PREFIX = ['sb', 'secret', ''].join('_');
const PUBLISHABLE_PREFIX = ['sb', 'publishable', ''].join('_');

let dir: string;

function scan(): { status: number; output: string } {
  try {
    const output = execFileSync('bash', [SCRIPT, dir], { encoding: 'utf8' });
    return { status: 0, output };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

function chunk(name: string, contents: string): void {
  writeFileSync(path.join(dir, name), contents, 'utf8');
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'secrelyte-bundle-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('check-bundle-secrets.sh', () => {
  it('passes on a bundle with no key material', () => {
    chunk('app.js', 'let a=1;export{a};');
    const { status, output } = scan();
    expect(status).toBe(0);
    expect(output).toContain('bundle clean');
  });

  it('passes on the vendor prefix predicate that used to break the gate', () => {
    // Verbatim shape of isNewApiKey from @supabase/supabase-js src/lib/fetch.ts.
    chunk(
      'vendor.js',
      `let nh=e=>e.startsWith("${PUBLISHABLE_PREFIX}")||e.startsWith("${SECRET_PREFIX}");`,
    );
    const { status } = scan();
    expect(status).toBe(0);
  });

  it('fails on a new-format secret key value', () => {
    chunk('leak.js', `const k="${SECRET_PREFIX}7f3Kq9wPz2Lm4Nv8Rt6Ub1Xc5Yd0Ae";`);
    const { status, output } = scan();
    expect(status).toBe(1);
    expect(output).toContain('new-format secret key value');
    expect(output).toContain('leak.js');
  });

  it('fails on the CI placeholder value, which is a real inlining bug', () => {
    chunk('leak.js', `const k="${SECRET_PREFIX}ci_placeholder_not_real";`);
    expect(scan().status).toBe(1);
  });

  it('never echoes the matched secret into its own output', () => {
    const value = `${SECRET_PREFIX}7f3Kq9wPz2Lm4Nv8Rt6Ub1Xc5Yd0Ae`;
    chunk('leak.js', `const k="${value}";`);
    const { output } = scan();
    expect(output).not.toContain(value);
  });

  it('fails on a legacy JWT api key', () => {
    const jwt = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'eyJyb2xlIjoiYW5vbiJ9', 'sIgNaTuRe'].join(
      '.',
    );
    chunk('leak.js', `const k="${jwt}";`);
    const { status, output } = scan();
    expect(status).toBe(1);
    expect(output).toContain('legacy JWT api key');
  });

  it('fails on a decoded service_role claim', () => {
    chunk('leak.js', 'const c={"role":"service_role"};');
    const { status, output } = scan();
    expect(status).toBe(1);
    expect(output).toContain('decoded service_role claim');
  });

  it('finds a leak in a nested chunk directory', () => {
    mkdirSync(path.join(dir, 'chunks', 'deep'), { recursive: true });
    writeFileSync(
      path.join(dir, 'chunks', 'deep', 'x.js'),
      `const k="${SECRET_PREFIX}7f3Kq9wPz2Lm4Nv8Rt6Ub1Xc5Yd0Ae";`,
      'utf8',
    );
    expect(scan().status).toBe(1);
  });

  it('fails when the scan root does not exist', () => {
    const missing = path.join(dir, 'nope');
    let status = 0;
    try {
      execFileSync('bash', [SCRIPT, missing], { encoding: 'utf8' });
    } catch (err) {
      status = (err as { status?: number }).status ?? 1;
    }
    expect(status).toBe(1);
  });
});
