#!/usr/bin/env node
/**
 * Report whether Phase 2 tables exist on the hosted project.
 * Uses the Data API (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY).
 * Does not print secrets.
 *
 * share_verifications has no table GRANT; a 401/403 there still means applied.
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const TABLES = [
  'user_keys',
  'products',
  'secrets',
  'shared_links',
  'share_verifications',
  'audit_log',
];

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

export function classifyTablePresence(http, body) {
  const blob = `${body || ''}`.toLowerCase();
  if (http === 200) return 'present';
  if (blob.includes('pgrst205') || blob.includes('could not find the table')) {
    return 'missing';
  }
  if (http === 401 || http === 403 || blob.includes('42501') || blob.includes('permission denied')) {
    return 'present';
  }
  return 'unknown';
}

async function main() {
  const env = loadEnv();
  const base = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;

  if (!base || !secret) {
    console.error(
      'FAIL: need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local',
    );
    process.exit(1);
  }

  let origin;
  try {
    origin = new URL(base).origin;
  } catch {
    console.error('FAIL: NEXT_PUBLIC_SUPABASE_URL is not a URL');
    process.exit(1);
  }

  const headers = {
    apikey: secret,
    Authorization: `Bearer ${secret}`,
    Accept: 'application/json',
  };

  const results = [];
  for (const table of TABLES) {
    const res = await fetch(`${origin}/rest/v1/${table}?select=*&limit=0`, {
      headers,
    });
    const body = await res.text();
    const state = classifyTablePresence(res.status, body);
    let code = '';
    try {
      const json = JSON.parse(body);
      code = json.code || '';
    } catch {
      code = '';
    }
    results.push({ table, http: res.status, state, code });
  }

  const present = results.filter((r) => r.state === 'present').map((r) => r.table);
  const missing = results.filter((r) => r.state === 'missing').map((r) => r.table);
  const unknown = results.filter((r) => r.state === 'unknown').map((r) => r.table);

  console.log(`hosted: ${origin}`);
  if (missing.length === 0 && unknown.length === 0) {
    console.log('schema: applied (Phase 2 tables visible to the Data API)');
  } else if (present.length === 0) {
    console.log('schema: not applied (no Phase 2 tables in the Data API)');
  } else {
    console.log(
      `schema: partial (present ${present.length}/${TABLES.length}, missing ${missing.join(', ') || 'none'})`,
    );
  }
  for (const r of results) {
    const extra = r.state === 'present' ? '' : ` ${r.http} ${r.code}`.trimEnd();
    console.log(`  ${r.table}: ${r.state}${extra ? ` (${extra.trim()})` : ''}`);
  }

  if (missing.length === 0 && unknown.length === 0) process.exit(0);
  process.exit(2);
}

const isMain = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return pathToFileURL(realpathSync(entry)).href === import.meta.url;
  } catch {
    return false;
  }
})();

if (isMain) {
  await main();
}
