#!/usr/bin/env bash
# Runs the full Playwright suite against local Supabase, including the vault specs that drive
# a real signup, recovery kit, store and reveal (they skip unless E2E_VAULT is set). The same
# script runs locally and in CI, so a green local run is the CI run.
#
# Needs local Supabase running (`pnpm exec supabase start`). Resets the local database first,
# as scripts/test-rls.sh does, so every run starts from the migrations.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# CI installs with --ignore-scripts, which can skip the npm package's binary download, and
# provides the CLI on PATH instead. Locally the devDependency is the usual source.
if command -v supabase >/dev/null 2>&1; then
  SUPABASE=(supabase)
else
  SUPABASE=(pnpm exec supabase)
fi

if ! "${SUPABASE[@]}" status >/dev/null 2>&1; then
  echo "FAIL: local Supabase is not running. Start it with: pnpm exec supabase start"
  exit 1
fi
"${SUPABASE[@]}" db reset --yes

# Local keys are deterministic per project and only work against this machine's containers.
# Read them at runtime instead of committing them. Parsed, not eval'd, so CLI output is never
# executed as shell.
STATUS_ENV="$("${SUPABASE[@]}" status -o env 2>/dev/null)"
status_var() {
  printf '%s\n' "$STATUS_ENV" | sed -n "s/^$1=\"\(.*\)\"\$/\1/p"
}
API_URL="$(status_var API_URL)"
PUBLISHABLE_KEY="$(status_var PUBLISHABLE_KEY)"
SECRET_KEY="$(status_var SECRET_KEY)"
: "${API_URL:?supabase status reported no API_URL}"
: "${PUBLISHABLE_KEY:?supabase status reported no PUBLISHABLE_KEY}"
: "${SECRET_KEY:?supabase status reported no SECRET_KEY}"

if [ -n "${GITHUB_ACTIONS:-}" ]; then
  echo "::add-mask::$SECRET_KEY"
fi

PORT="${PORT:-3457}"
export PORT
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY"
export NEXT_PUBLIC_APP_URL="http://127.0.0.1:$PORT"
export SUPABASE_SECRET_KEY="$SECRET_KEY"
export E2E_VAULT=1

pnpm build
# This build had a real-format secret key in its environment, unlike the placeholder build in
# the gate job, which makes the bundle check here the stronger of the two.
pnpm check:bundle
pnpm test:e2e
