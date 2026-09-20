#!/usr/bin/env bash
# scripts/check-bundle-secrets.sh
#
# Gate: no server secret VALUE may appear in the client bundle.
# (Definition of Done, "the five that override everything", item 2.)
#
# Matches key values, not key names. The earlier version grepped the bare token
# `sb_secret_`, which @supabase/supabase-js names as a string literal in its own
# `isNewApiKey` prefix check (src/lib/fetch.ts). That is vendor code carrying no key, so a
# name-based grep is red on every build regardless of whether a secret leaked.
#
# Key formats per https://supabase.com/docs/guides/api/api-keys (read 2026-09-21):
# new-format keys are short non-JWT strings after an `sb_publishable_` / `sb_secret_`
# prefix; legacy keys are JWTs beginning `eyJ`. The suffix charset is not published, so the
# floor below is deliberately loose on charset and length.
#
# Usage: check-bundle-secrets.sh [scan-root]   (default: .next/static)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SCAN_ROOT="${1:-.next/static}"

if [ ! -d "$SCAN_ROOT" ]; then
  echo "FAIL: $SCAN_ROOT missing. Run pnpm build first."
  exit 1
fi

# Pattern names are reported; matched text is NOT, so a failure never prints the secret
# into a CI log.
PATTERNS=(
  'new-format secret key value:sb_secret_[A-Za-z0-9_-]{8,}'
  'legacy JWT api key:eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.'
  'decoded service_role claim:"role"[[:space:]]*:[[:space:]]*"service_role"'
)

STATUS=0
for entry in "${PATTERNS[@]}"; do
  NAME="${entry%%:*}"
  PATTERN="${entry#*:}"
  FOUND="$(grep -rlE "$PATTERN" "$SCAN_ROOT" 2>/dev/null || true)"
  if [ -n "$FOUND" ]; then
    echo "FATAL: $NAME in the client bundle:"
    echo "$FOUND" | sed 's/^/  /'
    STATUS=1
  fi
done

if [ "$STATUS" -ne 0 ]; then
  exit 1
fi
echo "bundle clean ($SCAN_ROOT)"
