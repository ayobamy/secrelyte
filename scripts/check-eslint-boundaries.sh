#!/usr/bin/env bash
# Prove ESLint blocks a libsodium import from app/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
TMP="app/.eslint-sodium-probe.ts"
cleanup() { rm -f "$TMP"; }
trap cleanup EXIT

cat > "$TMP" <<'TS'
import sodium from 'libsodium-wrappers-sumo';
export const leak = sodium;
TS

set +e
OUT="$(pnpm exec eslint "$TMP" 2>&1)"
STATUS=$?
set -e

if [ "$STATUS" -eq 0 ]; then
  echo "FAIL: eslint allowed a libsodium import from app/"
  echo "$OUT"
  exit 1
fi

if ! printf '%s' "$OUT" | grep -q 'no-restricted-imports'; then
  echo "FAIL: eslint failed but not because of no-restricted-imports"
  echo "$OUT"
  exit 1
fi

echo "OK: libsodium import from app/ is blocked"
