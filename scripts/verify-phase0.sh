#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== 0.1 next version =="
bash scripts/check-next-version.sh

echo "== 0.2 gitignore =="
git check-ignore -q .env.local
echo "OK: .env.local is ignored"

echo "== 0.3 gitleaks =="
bash scripts/check-gitleaks.sh

echo "== 0.4 eslint boundary =="
bash scripts/check-eslint-boundaries.sh

echo "== 0.4/0.5 lint + unit =="
pnpm lint
pnpm test:unit

echo "== 0.12 npmrc =="
grep -q '^ignore-scripts=true' .npmrc
echo "OK: ignore-scripts=true"

echo "== 0.6 service dirs =="
for s in crypto vault sharing agent audit notify; do
  test -f "services/$s/README.md"
  test -d "services/$s/test"
  test -f "services/$s/src/index.ts"
done
echo "OK: six services"

echo "== 0.7 contracts =="
pnpm test:contracts

echo "== crypto boundary =="
bash scripts/check-crypto-boundary.sh

echo "== 0.8 key format (no values printed) =="
set +e
node scripts/check-env-format.mjs
ENV_STATUS=$?
set -e
if [ "$ENV_STATUS" -eq 1 ]; then
  exit 1
fi
if [ "$ENV_STATUS" -eq 2 ]; then
  echo "CONCERN: SUPABASE_SECRET_KEY missing from .env.local"
fi

echo "Phase 0 local gates green. Build, e2e, headers, and audit run separately."
