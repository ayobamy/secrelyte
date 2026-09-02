#!/usr/bin/env bash
# scripts/check-bundle-secrets.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -d .next/static ]; then
  echo "FAIL: .next/static missing. Run pnpm build first."
  exit 1
fi

FOUND="$(grep -rlE 'sb_secret_|service_role' .next/static/ 2>/dev/null || true)"
if [ -n "$FOUND" ]; then
  echo "FATAL: secret key material in the client bundle:"
  echo "$FOUND"
  exit 1
fi
echo "bundle clean"
