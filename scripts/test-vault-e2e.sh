#!/usr/bin/env bash
# Runs the full Playwright suite against local Supabase, including the vault specs that drive
# a real signup, recovery kit, store and reveal (they skip unless E2E_VAULT=1). The same script
# runs locally and in CI, so a green local run is the CI run. It fails if any test skips: a
# lost E2E_VAULT would otherwise skip every vault spec and still exit 0.
#
# Needs local Supabase running (`pnpm exec supabase start`). Resets the local database first,
# as scripts/test-rls.sh does, so every run starts from the migrations.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# The pinned devDependency, everywhere. Under pnpm its shim is first on PATH anyway, and one
# CLI driving the stack means one version to keep in step with CI.
SUPABASE=(pnpm exec supabase)

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
# Built with this machine's real local keys in the environment, so the exact-value layer of
# the bundle check searches for them.
pnpm check:bundle

REPORT="$(mktemp)"
trap 'rm -f "$REPORT"' EXIT
# No retries: a timing test that only passes on a second attempt is a failure here. A failing
# test keeps its trace in test-results/, which CI uploads. Extra arguments narrow the run, for
# example to one spec file; the skip check below still applies to whatever ran.
PLAYWRIGHT_JSON_OUTPUT_NAME="$REPORT" pnpm exec playwright test --reporter=list,json \
  --retries=0 --trace=retain-on-failure "$@"

node -e '
const { stats } = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const ran = stats.expected + stats.unexpected + stats.flaky;
console.log(`vault e2e: ${stats.expected} passed, ${stats.skipped} skipped, ${stats.unexpected} failed`);
if (stats.skipped > 0 || stats.unexpected > 0 || stats.flaky > 0 || ran === 0) {
  console.error("FAIL: every spec must run and pass in the vault lane; none may skip.");
  process.exit(1);
}' "$REPORT"
