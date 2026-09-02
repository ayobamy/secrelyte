#!/usr/bin/env node
/**
 * Apply supabase/migrations to the hosted project.
 *
 * SUPABASE_SECRET_KEY is the Data API key. It cannot run DDL.
 * This command needs SUPABASE_DB_URL (Postgres URI, port 5432).
 * Direct db.PROJECT.supabase.co is IPv6-only; the script rewrites it to
 * the IPv4 session pooler (aws-0-<region>.pooler.supabase.com:5432).
 *
 * Dry run:  pnpm db:push -- --dry-run
 * Live:     SECRELYTE_CONFIRM_REMOTE_MIGRATE=1 pnpm db:push
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertRemoteDbUrl,
  remoteMigrateAllowed,
  toSessionPoolerUrl,
} from './assert-remote-db-url.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#') || !s.includes('=')) continue;
    const i = s.indexOf('=');
    out[s.slice(0, i)] = s.slice(i + 1).replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function loadEnv() {
  const file = join(root, '.env.local');
  const fromFile = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
  return { ...fromFile, ...process.env };
}

const env = loadEnv();
const dryRun = process.argv.includes('--dry-run');

let dbUrl;
let target;
try {
  assertRemoteDbUrl(env.SUPABASE_DB_URL);
  const pooler = toSessionPoolerUrl(
    env.SUPABASE_DB_URL,
    env.SUPABASE_POOLER_REGION,
  );
  dbUrl = pooler.url;
  target = assertRemoteDbUrl(dbUrl);
  if (pooler.rewritten) {
    console.log(
      `Direct db.*.supabase.co is IPv6-only. Using session pooler ${pooler.host}:5432`,
    );
  }
} catch (err) {
  console.error(`FAIL: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

if (!remoteMigrateAllowed(dryRun, env.SECRELYTE_CONFIRM_REMOTE_MIGRATE)) {
  console.error('FAIL: this applies DDL to the hosted Postgres (not the local Docker DB).');
  console.error('Dry run:  pnpm db:push -- --dry-run');
  console.error('Live:     SECRELYTE_CONFIRM_REMOTE_MIGRATE=1 pnpm db:push');
  process.exit(1);
}

console.log(
  dryRun
    ? `Dry-run db push -> ${target.host}:${target.port}`
    : `Applying migrations -> ${target.host}:${target.port}`,
);
console.log(
  'Enable pg_cron on the project (Dashboard > Database > Extensions) before 0001 if it is not already on.',
);

const args = [
  'exec',
  'supabase',
  'db',
  'push',
  '--db-url',
  dbUrl,
  '--yes',
  '--skip-vault',
];
if (dryRun) args.push('--dry-run');

const result = spawnSync('pnpm', args, {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' },
});

process.exit(result.status === null ? 1 : result.status);
