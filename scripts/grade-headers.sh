#!/usr/bin/env bash
# Grade response headers on / and /vault against the local A checklist.
# Live securityheaders.com is attempted when NEXT_PUBLIC_APP_URL is a public https origin.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-3456}"
BASE="http://127.0.0.1:${PORT}"

if [ ! -d .next ]; then
  echo "FAIL: run pnpm build before check:headers"
  exit 1
fi

export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://example.supabase.co}"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-sb_publishable_ci_placeholder_not_real}"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-$BASE}"

pnpm start --port "$PORT" >/tmp/secrelyte-next-start.log 2>&1 &
PID=$!
cleanup() { kill "$PID" 2>/dev/null || true; }
trap cleanup EXIT

for _ in $(seq 1 40); do
  if curl -sf "$BASE" >/dev/null; then
    break
  fi
  sleep 0.25
done

grade_path() {
  local path="$1"
  local headers
  headers="$(curl -sI "$BASE$path")"
  echo "---- $path ----"
  echo "$headers"
  echo "$headers" | grep -qi 'Content-Security-Policy:' || { echo "FAIL: missing CSP on $path"; return 1; }
  echo "$headers" | grep -qi 'X-Content-Type-Options: nosniff' || { echo "FAIL: missing nosniff on $path"; return 1; }
  echo "$headers" | grep -qi 'X-Frame-Options: DENY' || { echo "FAIL: missing frame options on $path"; return 1; }
  echo "$headers" | grep -qi 'Referrer-Policy:' || { echo "FAIL: missing referrer-policy on $path"; return 1; }
  echo "$headers" | grep -qi 'Permissions-Policy:' || { echo "FAIL: missing permissions-policy on $path"; return 1; }
}

grade_path /
grade_path /vault
grade_path /s/example-token

echo "OK: local header checklist green on /, /vault, /s/*"

APP_URL="${NEXT_PUBLIC_APP_URL:-}"
if [[ "$APP_URL" == https://* ]] && [[ "$APP_URL" != *localhost* ]]; then
  echo "Live scan: $APP_URL"
  CODE="$(curl -sS -o /tmp/secrelyte-securityheaders.html -w '%{http_code}' "https://securityheaders.com/?q=${APP_URL}&followRedirects=on" || true)"
  if grep -qi 'Grade A' /tmp/secrelyte-securityheaders.html; then
    echo "OK: securityheaders.com Grade A"
  else
    echo "WARN: securityheaders.com did not report Grade A (HTTP $CODE). Local checklist still passed."
    exit 1
  fi
else
  echo "SKIP: securityheaders.com needs a public https URL. Local checklist is the Phase 0 evidence until deploy."
fi
