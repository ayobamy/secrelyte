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
const ANTHROPIC_PREFIX = ['sk', 'ant', ''].join('-');
const RESEND_PREFIX = ['re', ''].join('_');
const WEBHOOK_PREFIX = ['whsec', ''].join('_');
const HEX64 = 'a1'.repeat(32);

let dir: string;
/**
 * Env fixtures live in their own directory, named as Next names them (.env.local, .env), and
 * outside the scanned directory, or the gate would find each secret in its own file.
 */
let envDir: string;

function envFile(name: '.env' | '.env.local' | '.env.production', contents: string): void {
  writeFileSync(path.join(envDir, name), contents, 'utf8');
}

/** Runs the gate with only the env given here: no inherited secrets, no real .env.local. */
function scan(
  env: Record<string, string> = {},
  dirs: string[] = [dir],
): { status: number; output: string } {
  try {
    const output = execFileSync('bash', [SCRIPT, ...dirs], {
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH ?? '',
        // As `next build` runs. The gate sets it for its env reader anyway.
        NODE_ENV: 'production',
        SECRELYTE_ENV_DIR: path.join(dir, 'no-env-dir'),
        ...env,
      },
    });
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
  envDir = mkdtempSync(path.join(tmpdir(), 'secrelyte-env-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(envDir, { recursive: true, force: true });
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
    expect(output).toContain('Supabase secret key value');
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
  it('fails on an Anthropic key value', () => {
    chunk('leak.js', `const k="${ANTHROPIC_PREFIX}api03-7f3Kq9wPz2Lm4Nv8Rt6Ub1Xc5Yd0Ae";`);
    const { status, output } = scan();
    expect(status).toBe(1);
    expect(output).toContain('Anthropic API key value');
  });

  it('fails on a Resend key value', () => {
    chunk('leak.js', `const k="${RESEND_PREFIX}123456789_AbCdEfGhIjKlMnOpQrSt";`);
    expect(scan().output).toContain('Resend API key value');
  });

  it('fails on a webhook signing secret value', () => {
    chunk('leak.js', `const k="${WEBHOOK_PREFIX}MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";`);
    expect(scan().output).toContain('webhook signing secret value');
  });

  it('does not mistake a minified identifier for a Resend key', () => {
    chunk(
      'app.js',
      'let are_rendered_components_cache_key=1;export{are_rendered_components_cache_key};',
    );
    expect(scan().status).toBe(0);
  });

  it('fails on the exact value of a set secret, naming the variable but not the value', () => {
    chunk('leak.js', `window.s="${HEX64}";`);
    const { status, output } = scan({ SHARE_SESSION_SECRET: HEX64 });
    expect(status).toBe(1);
    expect(output).toContain('the value of SHARE_SESSION_SECRET');
    expect(output).not.toContain(HEX64);
  });

  it('reads secret values from the env file too', () => {
    envFile('.env.local', `EMAIL_BLIND_INDEX_PEPPER="${HEX64}"\n`);
    chunk('page.html', `<p>${HEX64}</p>`);
    const { status, output } = scan({ SECRELYTE_ENV_DIR: envDir });
    expect(status).toBe(1);
    expect(output).toContain('the value of EMAIL_BLIND_INDEX_PEPPER');
  });

  it('reads env files the way next build does: export, CRLF, quotes, inline comments', () => {
    const values = ['b1'.repeat(16), 'c2'.repeat(16), 'd3'.repeat(16)];
    envFile(
      '.env.local',
      [
        `export SHARE_SESSION_SECRET=${values[0]}\r`,
        `EMAIL_BLIND_INDEX_PEPPER=${values[1]} # rotated quarterly\r`,
        `  RESEND_WEBHOOK_SECRET = "${values[2]}" # signing`,
        '',
      ].join('\n'),
    );
    for (const [name, value] of [
      ['SHARE_SESSION_SECRET', values[0]],
      ['EMAIL_BLIND_INDEX_PEPPER', values[1]],
      ['RESEND_WEBHOOK_SECRET', values[2]],
    ] as const) {
      chunk('leak.js', `window.s="${value}";`);
      // Only the env file makes this value a known secret; no format pattern covers hex.
      expect(scan().status, name).toBe(0);
      const { status, output } = scan({ SECRELYTE_ENV_DIR: envDir });
      expect(status, name).toBe(1);
      expect(output).toContain(`the value of ${name}`);
    }
  });

  it('scans the value in every env file, not just the one Next would use', () => {
    // .env.local overrides .env, but the value left behind in .env is still a real secret.
    envFile('.env.local', `SHARE_SESSION_SECRET=${'e4'.repeat(16)}\n`);
    envFile('.env', `SHARE_SESSION_SECRET=${HEX64}\n`);
    chunk('app.js', 'let a=1;');
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).output).toContain('2 secret values checked');
    chunk('leak.js', `window.s="${HEX64}";`);
    const { status, output } = scan({ SECRELYTE_ENV_DIR: envDir });
    expect(status).toBe(1);
    expect(output).toContain('the value of SHARE_SESSION_SECRET');
  });

  it('scans each line of a multi-line value on its own', () => {
    const line = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC';
    envFile('.env.local', `SUPABASE_DB_URL="-----BEGIN KEY-----\n${line}\n-----END KEY-----"\n`);
    chunk('leak.js', `const k="${line}";`);
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).status).toBe(1);
    // The armor lines are public: a bundle that names the format is not a leak.
    chunk('leak.js', 'const marker="-----BEGIN KEY-----";');
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).status).toBe(0);
  });

  it('by default scans prerendered pages and header files, not only static chunks', () => {
    const build = path.join(dir, 'build');
    for (const sub of ['static/chunks', 'server/app', 'server/pages']) {
      mkdirSync(path.join(build, sub), { recursive: true });
    }
    writeFileSync(path.join(build, 'static/chunks', 'main.js'), 'let a=1;', 'utf8');
    for (const leak of ['server/pages/404.html', 'server/app/index.meta']) {
      const target = path.join(build, leak);
      writeFileSync(target, `{"x-debug":"${HEX64}"}`, 'utf8');
      const { status, output } = scan(
        { SECRELYTE_BUILD_DIR: build, SHARE_SESSION_SECRET: HEX64 },
        [],
      );
      expect(status, leak).toBe(1);
      expect(output).toContain(leak);
      rmSync(target);
    }
    // Server-only code never reaches a browser and is not scanned.
    writeFileSync(path.join(build, 'server/app', 'page.js'), `const s="${HEX64}";`, 'utf8');
    expect(scan({ SECRELYTE_BUILD_DIR: build, SHARE_SESSION_SECRET: HEX64 }, []).status).toBe(0);
  });

  it('scans a secret as Next expands it, and the variable it was built from', () => {
    const password = 'f5'.repeat(12);
    envFile(
      '.env.local',
      `DB_PASSWORD=${password}\nSUPABASE_DB_URL=postgres://app:\${DB_PASSWORD}@db.internal:5432/main\n`,
    );
    // The URL exactly as the build would inline it.
    chunk('leak.js', `const u="postgres://app:${password}@db.internal:5432/main";`);
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).output).toContain('the value of SUPABASE_DB_URL');
    // The password alone, which no variable in the list is named after.
    chunk('leak.js', `const p="${password}";`);
    const { status, output } = scan({ SECRELYTE_ENV_DIR: envDir });
    expect(status).toBe(1);
    expect(output).toContain('the value of DB_PASSWORD (used in SUPABASE_DB_URL)');
  });

  it('follows a secret through every level of variables it is built from', () => {
    const password = 'c9'.repeat(12);
    envFile(
      '.env.local',
      `SUPABASE_DB_URL=\${DB_URL}\nDB_URL=postgres://app:\${DB_PASSWORD}@db.internal/main\nDB_PASSWORD=${password}\n`,
    );
    chunk('leak.js', `const p="${password}";`);
    const { status, output } = scan({ SECRELYTE_ENV_DIR: envDir });
    expect(status).toBe(1);
    expect(output).toContain('the value of DB_PASSWORD (used in SUPABASE_DB_URL)');
  });

  it('reads a KEY: value line even in a file another one overrides', () => {
    const overridden = 'b8'.repeat(16);
    envFile('.env.local', `SHARE_SESSION_SECRET=${'0d'.repeat(16)}\n`);
    envFile('.env', `SHARE_SESSION_SECRET: ${overridden}\n`);
    chunk('leak.js', `window.s="${overridden}";`);
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).status).toBe(1);
  });

  // A Supabase pooler URL names the project ref, which the public API URL carries too. The ref
  // is on the PUBLIC_REFERENCES allowlist; the password next to it is not.
  it('skips an allowlisted public reference and still scans the secret beside it', () => {
    const ref = 'abcdefghijklmnopqrst';
    const password = 'e1'.repeat(12);
    envFile(
      '.env.local',
      [
        `SUPABASE_PROJECT_REF=${ref}`,
        `DB_PASSWORD=${password}`,
        `NEXT_PUBLIC_SUPABASE_URL=https://\${SUPABASE_PROJECT_REF}.supabase.co`,
        `SUPABASE_DB_URL=postgresql://postgres.\${SUPABASE_PROJECT_REF}:\${DB_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`,
        '',
      ].join('\n'),
    );
    chunk('app.js', `const url="https://${ref}.supabase.co";`);
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).status).toBe(0);
    chunk('leak.js', `const p="${password}";`);
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).output).toContain(
      'the value of DB_PASSWORD (used in SUPABASE_DB_URL)',
    );
  });

  // Copying a secret into a NEXT_PUBLIC_ name is how secrets usually reach a Next bundle.
  it('catches a secret republished under a NEXT_PUBLIC_ name', () => {
    const password = 'f2'.repeat(12);
    envFile(
      '.env.local',
      [
        `DB_PASSWORD=${password}`,
        `NEXT_PUBLIC_DB_PASSWORD=\${DB_PASSWORD}`,
        `SUPABASE_DB_URL=postgres://app:\${DB_PASSWORD}@db.internal:5432/main`,
        '',
      ].join('\n'),
    );
    chunk('leak.js', `const p="${password}";`);
    const { status, output } = scan({ SECRELYTE_ENV_DIR: envDir });
    expect(status).toBe(1);
    expect(output).toContain('the value of DB_PASSWORD (used in SUPABASE_DB_URL)');
  });

  it('follows a reference through a public variable, skipping only an allowlisted one', () => {
    const password = 'a3'.repeat(12);
    envFile(
      '.env.local',
      [
        `DB_PASSWORD=${password}`,
        'NEXT_PUBLIC_APP_URL=https://app.example.com/v1',
        `NEXT_PUBLIC_LEAKY=user:\${DB_PASSWORD}`,
        'SUPABASE_DB_URL=postgres://app@db.internal/main?api=\${NEXT_PUBLIC_APP_URL}&x=\${NEXT_PUBLIC_LEAKY}',
        '',
      ].join('\n'),
    );
    // The allowlisted public URL in the bundle is fine.
    chunk('app.js', 'const api="https://app.example.com/v1";');
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).status).toBe(0);
    // The password the public variable carries is not.
    chunk('leak.js', `const p="${password}";`);
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).output).toContain(
      'the value of DB_PASSWORD (used in SUPABASE_DB_URL)',
    );
  });

  // A NEXT_PUBLIC_ prefix says a value ships, not that it should: a secret written straight into
  // a public name and used by a server secret is still a secret.
  it('scans a NEXT_PUBLIC_ variable a server secret is built from unless it is allowlisted', () => {
    const password = 'b4'.repeat(12);
    envFile(
      '.env.local',
      [
        `NEXT_PUBLIC_DB_PASSWORD=${password}`,
        'SUPABASE_DB_URL=postgres://app:\${NEXT_PUBLIC_DB_PASSWORD}@db.internal/main',
        '',
      ].join('\n'),
    );
    chunk('leak.js', `const p="${password}";`);
    const { status, output } = scan({ SECRELYTE_ENV_DIR: envDir });
    expect(status).toBe(1);
    expect(output).toContain('the value of NEXT_PUBLIC_DB_PASSWORD (used in SUPABASE_DB_URL)');
  });

  // Deny by default: a reference that only looks public stays a secret until someone lists it.
  it('scans a referenced value that is not on the allowlist, even if a public value carries it', () => {
    const ref = 'zyxwvutsrqponmlkjihg';
    envFile(
      '.env.local',
      [
        `SUPABASE_REF=${ref}`,
        `NEXT_PUBLIC_SUPABASE_URL=https://\${SUPABASE_REF}.supabase.co`,
        'SUPABASE_DB_URL=postgresql://postgres.\${SUPABASE_REF}@pooler.supabase.com/postgres',
        '',
      ].join('\n'),
    );
    chunk('app.js', `const url="https://${ref}.supabase.co";`);
    const { status, output } = scan({ SECRELYTE_ENV_DIR: envDir });
    expect(status).toBe(1);
    expect(output).toContain('the value of SUPABASE_REF (used in SUPABASE_DB_URL)');
  });

  // parseEnv has no escapes: "C:\tools\" ends at its second quote. Treating the backslash as an
  // escape kept the quote open and skipped the next entry.
  it('reads quotes the way parseEnv does: a backslash escapes nothing', () => {
    const secret = 'c5'.repeat(16);
    // A later quoted entry gives an escape-reading parser somewhere to close, past the secret.
    envFile('.env', `WIN_DIR="C:\\tools\\"\nSHARE_SESSION_SECRET: ${secret}\nLABEL="x"\n`);
    envFile('.env.local', `SHARE_SESSION_SECRET=${'d6'.repeat(16)}\n`);
    chunk('leak.js', `window.s="${secret}";`);
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).status).toBe(1);
  });

  // An opening quote with no closing one later in the file is a one-line value to parseEnv,
  // not the start of a value that swallows the rest of the file.
  it('reads quotes the way parseEnv does: an unclosed quote is one line', () => {
    const secret = 'e7'.repeat(16);
    envFile('.env', `NOTE='unterminated\nSHARE_SESSION_SECRET: ${secret}\n`);
    envFile('.env.local', `SHARE_SESSION_SECRET=${'f8'.repeat(16)}\n`);
    chunk('leak.js', `window.s="${secret}";`);
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).status).toBe(1);
  });

  it('reads a KEY: value line in a CRLF file', () => {
    const overridden = '9a'.repeat(16);
    envFile('.env', `SHARE_SESSION_SECRET: ${overridden}\r\nOTHER=1\r\n`);
    envFile('.env.local', `SHARE_SESSION_SECRET=${'8b'.repeat(16)}\r\n`);
    chunk('leak.js', `window.s="${overridden}";`);
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).status).toBe(1);
  });

  // Next reads an unclosed quote as one plain line; parseEnv reads on to the next quote
  // anywhere later, swallowing the entries in between. A value either one sees is scanned.
  it('scans a secret that only the loader Next uses sees, after an unclosed quote', () => {
    const secret = '5e'.repeat(16);
    envFile('.env', `GREETING="hello\nSHARE_SESSION_SECRET=${secret}\nLABEL="x" # note\n`);
    envFile('.env.local', `SHARE_SESSION_SECRET=${'4f'.repeat(16)}\n`);
    chunk('leak.js', `window.s="${secret}";`);
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).status).toBe(1);
  });

  // Next ignores `KEY : value` (a space before the colon). Reading it anyway replaced the real
  // value written above it, and scanned a placeholder in its place.
  it('ignores a KEY : value line, as Next does, and keeps the real value', () => {
    const secret = '3a'.repeat(16);
    const placeholder = 'placeholder-not-a-secret-value';
    envFile('.env', `SHARE_SESSION_SECRET=${secret}\nSHARE_SESSION_SECRET : ${placeholder}\n`);
    envFile('.env.local', `SHARE_SESSION_SECRET=${'2b'.repeat(16)}\n`);
    chunk('app.js', `const label="${placeholder}";`);
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).status).toBe(0);
    chunk('leak.js', `window.s="${secret}";`);
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).status).toBe(1);
  });

  // The reader hands values to bash as NAME NUL VALUE NUL. A NUL inside a value used to shift
  // every pair after it, so later secrets went unscanned and a value could be printed as a name.
  it('keeps names and values paired when a value holds a NUL, and prints no value', () => {
    const [first, second, pepper] = ['1a'.repeat(16), '2b'.repeat(16), '3c'.repeat(16)];
    envFile(
      '.env.local',
      `SHARE_SESSION_SECRET=${first}\0${second}\nEMAIL_BLIND_INDEX_PEPPER=${pepper}\n`,
    );
    chunk('app.js', 'const names="UPSTASH_REDIS_REST_TOKEN SHARE_SESSION_SECRET";');
    const clean = scan({ SECRELYTE_ENV_DIR: envDir });
    expect(clean.status).toBe(0);
    chunk('leak.js', `window.p="${pepper}";`);
    const { status, output } = scan({ SECRELYTE_ENV_DIR: envDir });
    expect(status).toBe(1);
    expect(output).toContain('the value of EMAIL_BLIND_INDEX_PEPPER');
    for (const value of [first, second, pepper]) expect(output).not.toContain(value);
  });

  // The loader Next uses reads \" as an escaped quote, so this quoted value runs on and swallows
  // the secret's line there. Only the parseEnv reading, with its KEY: value rewrite, sees it.
  it('still scans what only the parseEnv reading sees', () => {
    const secret = '4d'.repeat(16);
    for (const eol of ['\n', '\r']) {
      envFile(
        '.env',
        [`WIN_DIR="C:\\tools\\"`, `SHARE_SESSION_SECRET: ${secret}`, 'NOTE=hello"', ''].join(eol),
      );
      envFile('.env.local', `SHARE_SESSION_SECRET=${'5e'.repeat(16)}\n`);
      chunk('leak.js', `window.s="${secret}";`);
      expect(scan({ SECRELYTE_ENV_DIR: envDir }).status, JSON.stringify(eol)).toBe(1);
    }
  });

  // An entry only Next sees (past an unclosed quote) still has its references followed.
  it('follows references in an entry only the loader Next uses sees', () => {
    const password = '6f'.repeat(12);
    envFile(
      '.env',
      [
        'GREETING="hello',
        'SUPABASE_DB_URL=postgres://app:\${DB_PASSWORD}@db.internal:5432/main',
        'LABEL="x" # note',
        `DB_PASSWORD=${password}`,
        '',
      ].join('\n'),
    );
    chunk('leak.js', `const p="${password}";`);
    const { status, output } = scan({ SECRELYTE_ENV_DIR: envDir });
    expect(status).toBe(1);
    expect(output).toContain('the value of DB_PASSWORD (used in SUPABASE_DB_URL)');
  });

  // Reading one file alone must not expand its references against nothing: the result is a
  // string no build holds, and scanning it could fail a clean bundle.
  it('does not scan a reference expanded against one file alone', () => {
    envFile('.env.local', `DB_PASSWORD=${'7a'.repeat(12)}\n`);
    envFile('.env', 'SUPABASE_DB_URL=postgres://app:\${DB_PASSWORD}@db.internal:5432/main\n');
    chunk('app.js', 'const docs="postgres://app:@db.internal:5432/main";');
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).status).toBe(0);
  });

  // A reference to itself used to overflow the loader, whose error was swallowed, so that
  // file's Next reading came back empty.
  it('reads a file with a self-reference through the loader Next uses', () => {
    const secret = '8b'.repeat(16);
    envFile(
      '.env',
      [
        'LOOP=\${LOOP}',
        'GREETING="hello',
        `SHARE_SESSION_SECRET=${secret}`,
        'LABEL="x" # c',
        '',
      ].join('\n'),
    );
    envFile('.env.local', `SHARE_SESSION_SECRET=${'9c'.repeat(16)}\n`);
    chunk('leak.js', `window.s="${secret}";`);
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).status).toBe(1);
  });

  // The loader child reports its reading as JSON on stdout, which used to be capped at 1 MiB:
  // a valid file with large values failed the gate.
  it('reads an env file whose values add up to more than 1 MiB', () => {
    const lines = [0, 1, 2].map((i) => `CERT_BUNDLE_${i}=${'x'.repeat(400_000)}`);
    envFile('.env', `${lines.join('\n')}\n`);
    chunk('app.js', 'let a=1;');
    const { status, output } = scan({ SECRELYTE_ENV_DIR: envDir });
    expect(status, output).toBe(0);
  });

  it('reads a CR-only file the way Next does, one entry per line', () => {
    const overridden = '7c'.repeat(16);
    envFile('.env', `SHARE_SESSION_SECRET=${overridden}\rOTHER=1\r`);
    envFile('.env.local', `SHARE_SESSION_SECRET=${'6d'.repeat(16)}\n`);
    chunk('leak.js', `window.s="${overridden}";`);
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).status).toBe(1);
  });

  // The line holding the closing quote is still part of the value, even when it looks like a
  // KEY: value entry of its own.
  it('keeps the closing line of a multi-line value as part of the value', () => {
    const line = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC';
    envFile('.env', `SUPABASE_DB_URL="header-line-0123456789\nDEK-Info: ${line}"\n`);
    envFile('.env.local', 'SUPABASE_DB_URL=override_value_0123456789\n');
    chunk('leak.js', `const k="DEK-Info: ${line}";`);
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).status).toBe(1);
  });

  it('keeps a quoted multi-line value intact under a KEY: value entry too', () => {
    const line = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC';
    envFile('.env', `SUPABASE_DB_URL: "header-line-0123456789\nDEK-Info: ${line}\nend"\n`);
    envFile('.env.local', 'SUPABASE_DB_URL=override_value_0123456789\n');
    chunk('leak.js', `const k="DEK-Info: ${line}";`);
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).status).toBe(1);
  });

  it('keeps a quoted multi-line value intact while reading KEY: value lines', () => {
    const line = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC';
    // The second line of the quoted value looks like a `KEY: value` line on its own.
    envFile('.env', `SUPABASE_DB_URL="header-line-0123456789\nfirst: ${line}\nend"\n`);
    envFile('.env.local', `SUPABASE_DB_URL=override_value_0123456789\n`);
    // The overridden file's quoted value, as written, with its colon untouched.
    chunk('leak.js', `const k="first: ${line}";`);
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).status).toBe(1);
  });

  it('reads the KEY: value form Next accepts', () => {
    const value = 'a7'.repeat(16);
    envFile('.env.local', `SHARE_SESSION_SECRET: ${value}\n`);
    chunk('leak.js', `window.s="${value}";`);
    expect(scan({ SECRELYTE_ENV_DIR: envDir }).output).toContain(
      'the value of SHARE_SESSION_SECRET',
    );
  });

  it('ignores values too short to be a secret', () => {
    chunk('app.js', 'const label="postgres";');
    expect(scan({ SUPABASE_DB_URL: 'postgres' }).status).toBe(0);
  });

  it('scans every directory it is given', () => {
    // Siblings, not nested: a nested second directory would be found by scanning the first.
    const first = mkdtempSync(path.join(tmpdir(), 'secrelyte-first-'));
    const second = mkdtempSync(path.join(tmpdir(), 'secrelyte-second-'));
    try {
      writeFileSync(path.join(first, 'clean.js'), 'let a=1;', 'utf8');
      writeFileSync(
        path.join(second, 'x.js'),
        `const k="${ANTHROPIC_PREFIX}api03-7f3Kq9wPz2Lm4Nv8Rt6Ub1Xc5Yd0Ae";`,
        'utf8',
      );
      expect(scan({}, [first]).status).toBe(0);
      expect(scan({}, [first, second]).status).toBe(1);
    } finally {
      rmSync(first, { recursive: true, force: true });
      rmSync(second, { recursive: true, force: true });
    }
  });
});
