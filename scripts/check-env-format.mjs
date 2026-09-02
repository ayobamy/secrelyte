#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env.local');

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

if (!existsSync(envPath)) {
  console.log('SKIP: .env.local not present (CI). Format tests cover the schemas.');
  process.exit(0);
}

const env = parseEnv(readFileSync(envPath, 'utf8'));
const failures = [];

function kind(v) {
  if (typeof v !== 'string' || !v) return 'empty';
  if (v.startsWith('sb_publishable_')) return 'sb_publishable';
  if (v.startsWith('sb_secret_')) return 'sb_secret';
  if (v.startsWith('http://') || v.startsWith('https://')) return 'url';
  if (v.startsWith('re_')) return 'resend';
  if (v.startsWith('sk-ant-')) return 'anthropic';
  return 'other';
}

if (kind(env.NEXT_PUBLIC_SUPABASE_URL) !== 'url') {
  failures.push('NEXT_PUBLIC_SUPABASE_URL is not a URL');
}
if (kind(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) !== 'sb_publishable') {
  failures.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not sb_publishable_');
}
if (env.SUPABASE_SECRET_KEY && kind(env.SUPABASE_SECRET_KEY) !== 'sb_secret') {
  failures.push('SUPABASE_SECRET_KEY is present but not sb_secret_');
}
if (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith('sb_secret_')) {
  failures.push('secret key placed in a NEXT_PUBLIC_ var');
}

if (failures.length) {
  console.error('FAIL env format:');
  for (const f of failures) console.error('-', f);
  process.exit(1);
}

const hasSecret = Boolean(env.SUPABASE_SECRET_KEY);
console.log(
  `OK: publishable key is new-format. server secret key ${hasSecret ? 'present' : 'MISSING (add sb_secret_ before any BYPASSRLS path)'}`,
);
if (!hasSecret) {
  process.exit(2);
}
