#!/usr/bin/env bash
# 10 parallel consume_share calls must yield exactly max_views successes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
SHARE_ID="dddddddd-dddd-4ddd-8ddd-dddddddddddd"
OWNER="11111111-1111-4111-8111-111111111111"

psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '${OWNER}',
  'authenticated',
  'authenticated',
  'parallel-owner@example.com',
  crypt('test-password-12', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(), '', '', '', ''
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shared_links (
  id, owner_id, token_hash, payload_ciphertext, payload_nonce, wrapped_sdek,
  recipient_blind_index, recipient_ciphertext, item_count, expires_at, max_views
) VALUES (
  '${SHARE_ID}',
  '${OWNER}',
  decode(repeat('99', 32), 'hex'),
  decode(repeat('ab', 40), 'hex'),
  decode(repeat('ab', 24), 'hex'),
  decode(repeat('ab', 48), 'hex'),
  decode(repeat('ab', 32), 'hex'),
  decode(repeat('ab', 40), 'hex'),
  1,
  now() + interval '2 hours',
  3
) ON CONFLICT (id) DO UPDATE
  SET view_count = 0, revoked_at = NULL, locked_at = NULL,
      expires_at = now() + interval '2 hours';
SQL

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

ok=0
fail=0
for i in $(seq 1 10); do
  (
    if psql "$DB_URL" -v ON_ERROR_STOP=1 -c "SELECT * FROM public.consume_share('${SHARE_ID}');" \
      >"$WORKDIR/$i.out" 2>"$WORKDIR/$i.err"; then
      echo ok >"$WORKDIR/$i.status"
    else
      echo fail >"$WORKDIR/$i.status"
    fi
  ) &
done
wait

for i in $(seq 1 10); do
  if grep -qx ok "$WORKDIR/$i.status"; then
    ok=$((ok + 1))
  else
    fail=$((fail + 1))
  fi
done

echo "consume_share parallel: $ok ok, $fail fail"
if [ "$ok" -ne 3 ]; then
  echo "FAIL: expected exactly 3 successes, got $ok"
  cat "$WORKDIR"/*.err 2>/dev/null || true
  exit 1
fi
echo "OK: exactly max_views succeeded under 10 parallel callers"
