#!/usr/bin/env node
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const nextPkg = require('next/package.json');
const declared = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).dependencies.next;

function parse(v) {
  const m = String(v).replace(/^[^\d]*/, '').split('.').map(Number);
  return { major: m[0] ?? 0, minor: m[1] ?? 0, patch: m[2] ?? 0 };
}

function gte(a, b) {
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch >= b.patch;
}

const floor = { major: 15, minor: 2, patch: 3 };
const installed = parse(nextPkg.version);

if (!gte(installed, floor)) {
  console.error(`FAIL: next@${nextPkg.version} is below the CVE-2025-29927 floor 15.2.3`);
  process.exit(1);
}

console.log(`OK: next@${nextPkg.version} (declared ${declared}) >= 15.2.3`);
