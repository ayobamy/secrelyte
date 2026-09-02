#!/usr/bin/env bash
# Apply a rollback file. Destructive rollbacks that drop ciphertext tables
# require SECRELYTE_CONFIRM_DESTRUCTIVE_ROLLBACK=1.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "usage: $0 supabase/rollbacks/NNNN_rollback.sql"
  exit 1
fi
base="$(basename "$FILE")"
case "$base" in
  0002_*|0003_*|0004_*|0005_*|0006_*|0007_*)
    if [ "${SECRELYTE_CONFIRM_DESTRUCTIVE_ROLLBACK:-}" != "1" ]; then
      echo "FAIL: $base drops customer ciphertext or keys."
      echo "Re-run with SECRELYTE_CONFIRM_DESTRUCTIVE_ROLLBACK=1"
      exit 1
    fi
    ;;
esac
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$FILE"
