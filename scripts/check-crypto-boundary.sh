#!/usr/bin/env bash
# scripts/check-crypto-boundary.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
fail() { echo "FAIL: $1"; exit 1; }

files="$(grep -rl 'libsodium-wrappers' --include='*.ts' --include='*.tsx' app services contracts lib 2>/dev/null || true)"
n=0
if [ -n "$files" ]; then
  n="$(printf '%s\n' "$files" | sed '/^$/d' | wc -l | tr -d ' ')"
fi

if [ -f services/crypto/src/sodium.ts ]; then
  [ "$n" -eq 1 ] || fail "libsodium imported in $n files, expected exactly 1 (services/crypto/src/sodium.ts)"
else
  [ "$n" -eq 0 ] || fail "libsodium imported in $n files, expected 0 until Phase 1"
fi

if [ -d services/crypto/src ]; then
  if grep -rn 'Math\.random' services/crypto/src 2>/dev/null; then
    fail "Math.random in services/crypto"
  fi
  if grep -rn 'console\.' services/crypto/src 2>/dev/null; then
    fail "console in services/crypto"
  fi
  if grep -rnE "from ['\"]react['\"]|from ['\"]next|from ['\"]@supabase" services/crypto/src 2>/dev/null; then
    fail "framework import in services/crypto"
  fi
fi

if [ -f services/crypto/test/vectors.json ] && grep -n 'TBD' services/crypto/test/vectors.json; then
  fail "unfrozen test vector"
fi

echo "crypto boundary OK ($n libsodium import(s))"
