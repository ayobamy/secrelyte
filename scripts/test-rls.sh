#!/usr/bin/env bash
# Apply migrations (if needed), schema assertions, pgTAP RLS, parallel consume_share.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

pnpm exec supabase status >/dev/null
pnpm exec supabase db reset --yes
# CLI 2.116 has `db query`, not `db execute`. psql keeps ON_ERROR_STOP.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/verify-schema-security.sql
pnpm exec supabase test db
bash scripts/test-consume-share-parallel.sh
