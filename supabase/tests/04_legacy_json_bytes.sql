-- supabase/tests/04_legacy_json_bytes.sql
-- Migration 0014: legacy_json_bytes rebuilds a wrap that was stored as JSON text, and
-- repair_legacy_json_wraps applies it to exactly the legacy rows and touches nothing else.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- What supabase-js stored for a raw Uint8Array: the JSON text of {"0":b0,"1":b1,...}.
CREATE OR REPLACE FUNCTION pg_temp.as_legacy(p bytea)
RETURNS bytea LANGUAGE sql IMMUTABLE AS $$
  SELECT convert_to(
    '{' || string_agg(format('"%s":%s', i - 1, get_byte(p, i - 1)), ',' ORDER BY i) || '}',
    'UTF8')
  FROM generate_series(1, length(p)) AS i;
$$;

SELECT plan(15);

SELECT is(
  public.legacy_json_bytes(pg_temp.as_legacy('\x00ff7b2230223a10'::bytea)),
  '\x00ff7b2230223a10'::bytea,
  'rebuilds the exact bytes, including ones that look like the JSON prefix');

SELECT is(
  public.legacy_json_bytes(pg_temp.as_legacy(extensions.gen_random_bytes(72))) IS NOT NULL,
  true,
  'rebuilds a 72-byte wrap');

SELECT is(public.legacy_json_bytes(extensions.gen_random_bytes(72)), NULL,
  'leaves real wrap bytes alone');
SELECT is(public.legacy_json_bytes(convert_to('{"0":7, not json', 'UTF8')), NULL,
  'prefix alone is not enough');
SELECT is(public.legacy_json_bytes(convert_to('{"0":1,"2":3}', 'UTF8')), NULL,
  'keys must run 0..n-1');
SELECT is(public.legacy_json_bytes(convert_to('{"0":256}', 'UTF8')), NULL,
  'values must be bytes');
SELECT is(public.legacy_json_bytes(convert_to('{"0":"a"}', 'UTF8')), NULL,
  'values must be numbers');
SELECT is(public.legacy_json_bytes('\x7b2230223aff'::bytea), NULL,
  'invalid UTF-8 is not a legacy wrap');

SELECT is(
  has_function_privilege('anon', 'public.legacy_json_bytes(bytea)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.legacy_json_bytes(bytea)', 'EXECUTE'),
  false,
  'not callable through the API');

-- The repair over a table holding one of each: legacy, healthy, and JSON-prefixed but invalid.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'authenticated', 'authenticated', 'repair@example.com', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
);

CREATE TEMP TABLE wraps (product_id uuid, original bytea) ON COMMIT DROP;
INSERT INTO wraps VALUES
  ('d1111111-1111-4111-8111-111111111111', extensions.gen_random_bytes(72)),
  ('d2222222-2222-4222-8222-222222222222', extensions.gen_random_bytes(72)),
  ('d3333333-3333-4333-8333-333333333333', convert_to('{"0":1,"2":3}', 'UTF8'));

INSERT INTO public.products (id, user_id, name, wrapped_dek)
SELECT product_id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'repair ' || product_id,
       CASE WHEN product_id = 'd1111111-1111-4111-8111-111111111111'
            THEN pg_temp.as_legacy(original) ELSE original END
  FROM wraps;

SELECT is(public.repair_legacy_json_wraps(), 1, 'repairs exactly the one legacy row');

SELECT is(
  (SELECT p.wrapped_dek FROM public.products p WHERE p.id = 'd1111111-1111-4111-8111-111111111111'),
  (SELECT original FROM wraps WHERE product_id = 'd1111111-1111-4111-8111-111111111111'),
  'the legacy row now holds its original wrap bytes');

SELECT is(
  (SELECT p.wrapped_dek FROM public.products p WHERE p.id = 'd2222222-2222-4222-8222-222222222222'),
  (SELECT original FROM wraps WHERE product_id = 'd2222222-2222-4222-8222-222222222222'),
  'a healthy row is untouched');

SELECT is(
  (SELECT p.wrapped_dek FROM public.products p WHERE p.id = 'd3333333-3333-4333-8333-333333333333'),
  (SELECT original FROM wraps WHERE product_id = 'd3333333-3333-4333-8333-333333333333'),
  'a row that only looks like JSON is untouched');

SELECT is(public.repair_legacy_json_wraps(), 0, 'running it again changes nothing');

SELECT is(
  has_function_privilege('anon', 'public.repair_legacy_json_wraps()', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.repair_legacy_json_wraps()', 'EXECUTE')
    OR has_function_privilege('service_role', 'public.repair_legacy_json_wraps()', 'EXECUTE'),
  false,
  'the repair is not callable through the API');

SELECT * FROM finish();
ROLLBACK;
