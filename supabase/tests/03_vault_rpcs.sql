-- supabase/tests/03_vault_rpcs.sql
-- Phase 3 RPCs: get_own_keys, ack_recovery_kit, kdf_params_for_email, store_signup_keys.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION pg_temp.bytes(p_len int)
RETURNS bytea LANGUAGE sql IMMUTABLE AS $$
  SELECT decode(repeat('ab', p_len), 'hex');
$$;

CREATE OR REPLACE FUNCTION pg_temp.kdf_ok()
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT '{"alg":"argon2id","m":65536,"t":3,"p":1,"v":1}'::jsonb;
$$;

CREATE OR REPLACE FUNCTION pg_temp.kdf_alt()
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT '{"alg":"argon2id","m":19456,"t":3,"p":1,"v":1}'::jsonb;
$$;

CREATE OR REPLACE FUNCTION pg_temp.mint_user(p_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt('test-password-12', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.set_jwt(p_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_id::text, ''), true);
  PERFORM set_config('request.jwt.claim.role', p_role, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_id, 'role', p_role)::text,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.clear_jwt()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
END;
$$;

SELECT plan(14);

SELECT pg_temp.mint_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'owner@example.com');
SELECT pg_temp.mint_user('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'other@example.com');

SELECT pg_temp.set_jwt('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated');
SET ROLE authenticated;
INSERT INTO public.user_keys (
  user_id, wrapped_vault_key, wrapped_private_key, public_key, kdf_params
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  pg_temp.bytes(48),
  pg_temp.bytes(48),
  pg_temp.bytes(32),
  pg_temp.kdf_alt()
);
RESET ROLE;
SELECT pg_temp.clear_jwt();

SET ROLE anon;
SELECT throws_ok(
  $$SELECT * FROM public.get_own_keys()$$,
  '42501',
  NULL,
  'anon cannot execute get_own_keys'
);
RESET ROLE;

SELECT throws_ok(
  $$SELECT * FROM public.get_own_keys()$$,
  '28000',
  NULL,
  'get_own_keys without a session raises AUTH_REQUIRED'
);

SELECT pg_temp.set_jwt('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated');
SET ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM public.get_own_keys()),
  1,
  'owner get_own_keys returns one row'
);
SELECT ok(
  (SELECT octet_length(wrapped_vault_key) FROM public.get_own_keys()) = 48,
  'owner can read wrapped_vault_key through get_own_keys'
);
SELECT throws_ok(
  $$SELECT wrapped_vault_key FROM public.user_keys$$,
  '42501',
  NULL,
  'wrapped_vault_key remains ungranted on the table'
);
RESET ROLE;
SELECT pg_temp.clear_jwt();

SELECT pg_temp.set_jwt('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'authenticated');
SET ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM public.get_own_keys()),
  0,
  'other user get_own_keys does not return the owner row'
);
RESET ROLE;
SELECT pg_temp.clear_jwt();

SET ROLE anon;
SELECT is(
  public.kdf_params_for_email('nobody@example.com'),
  '{"alg":"argon2id","m":65536,"t":3,"p":1,"v":1}'::jsonb,
  'unknown email gets the default Argon2id JSON'
);
SELECT is(
  public.kdf_params_for_email('owner@example.com'),
  pg_temp.kdf_alt(),
  'known email returns the stored kdf_params'
);
RESET ROLE;

SELECT pg_temp.set_jwt('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated');
SET ROLE authenticated;
SELECT lives_ok(
  $$SELECT public.ack_recovery_kit()$$,
  'ack_recovery_kit succeeds for the owner'
);
SELECT ok(
  (SELECT recovery_ack_at IS NOT NULL FROM public.get_own_keys()),
  'ack_recovery_kit stamps recovery_ack_at'
);
SELECT lives_ok(
  $$SELECT public.ack_recovery_kit()$$,
  'ack_recovery_kit is idempotent'
);
RESET ROLE;
SELECT pg_temp.clear_jwt();

SELECT pg_temp.mint_user('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'signup@example.com');
SET ROLE service_role;
SELECT lives_ok(
  $$INSERT INTO public.user_keys (
      user_id, wrapped_vault_key, wrapped_private_key, public_key, kdf_params
    ) VALUES (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      pg_temp.bytes(48),
      pg_temp.bytes(48),
      pg_temp.bytes(32),
      pg_temp.kdf_ok()
    )$$,
  'service_role can insert user_keys for signup'
);
RESET ROLE;

SELECT pg_temp.mint_user('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'rpc-signup@example.com');
SET ROLE service_role;
SELECT lives_ok(
  $$SELECT public.store_signup_keys(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
      pg_temp.bytes(48),
      pg_temp.bytes(48),
      pg_temp.bytes(32),
      pg_temp.bytes(48),
      pg_temp.bytes(48),
      pg_temp.kdf_ok()
    )$$,
  'service_role can store signup keys via RPC'
);
RESET ROLE;

SELECT pg_temp.set_jwt('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated');
SET ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.store_signup_keys(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
      pg_temp.bytes(48),
      pg_temp.bytes(48),
      pg_temp.bytes(32),
      pg_temp.bytes(48),
      pg_temp.bytes(48),
      pg_temp.kdf_ok()
    )$$,
  '42501',
  NULL,
  'authenticated cannot execute store_signup_keys'
);
RESET ROLE;
SELECT pg_temp.clear_jwt();

SELECT * FROM finish();
ROLLBACK;
