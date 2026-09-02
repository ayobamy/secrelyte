-- supabase/tests/02_rls.sql
-- RLS as authenticated users, not the service role. Superuser is used only to
-- mint auth.users rows and to RESET ROLE. SET ROLE is issued in this file,
-- not inside helpers: SET ROLE inside a function is restored on function exit.

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

-- Transaction-local jwt claims. Pair with SET ROLE in the test body.
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

SELECT plan(32);

SELECT pg_temp.mint_user('11111111-1111-4111-8111-111111111111', 'a@example.com');
SELECT pg_temp.mint_user('22222222-2222-4222-8222-222222222222', 'b@example.com');

-- 2.1 anon cannot read user_keys (no grant)
SET ROLE anon;
SELECT throws_ok(
  $$SELECT user_id FROM public.user_keys$$,
  '42501',
  NULL,
  'anon SELECT on user_keys is denied'
);
RESET ROLE;
SELECT pg_temp.clear_jwt();

-- Owner writes keys; other user can read only public_key
SELECT pg_temp.set_jwt('11111111-1111-4111-8111-111111111111', 'authenticated');
SET ROLE authenticated;
INSERT INTO public.user_keys (
  user_id, wrapped_vault_key, wrapped_private_key, public_key, kdf_params
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  pg_temp.bytes(48),
  pg_temp.bytes(48),
  pg_temp.bytes(32),
  pg_temp.kdf_ok()
);
RESET ROLE;

SELECT pg_temp.set_jwt('22222222-2222-4222-8222-222222222222', 'authenticated');
SET ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM public.user_keys WHERE user_id = '11111111-1111-4111-8111-111111111111'),
  1,
  'other user can see public_key rows'
);
SELECT throws_ok(
  $$SELECT wrapped_vault_key FROM public.user_keys$$,
  '42501',
  NULL,
  'wrapped_vault_key is not granted to authenticated'
);
RESET ROLE;
SELECT pg_temp.clear_jwt();

-- Weak Argon2id params are rejected
SELECT pg_temp.set_jwt('22222222-2222-4222-8222-222222222222', 'authenticated');
SET ROLE authenticated;
SELECT throws_ok(
  $$INSERT INTO public.user_keys (
      user_id, wrapped_vault_key, wrapped_private_key, public_key, kdf_params
    ) VALUES (
      '22222222-2222-4222-8222-222222222222',
      decode(repeat('ab', 48), 'hex'),
      decode(repeat('ab', 48), 'hex'),
      decode(repeat('ab', 32), 'hex'),
      '{"alg":"argon2id","m":1000,"t":3,"p":1}'::jsonb
    )$$,
  '23514',
  NULL,
  'chk_kdf rejects memory below the OWASP floor'
);
RESET ROLE;
SELECT pg_temp.clear_jwt();

-- 2.2 products: user B cannot read or take over user A
SELECT pg_temp.set_jwt('11111111-1111-4111-8111-111111111111', 'authenticated');
SET ROLE authenticated;
INSERT INTO public.products (id, user_id, name, wrapped_dek)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'Stripe Production',
  pg_temp.bytes(48)
);
RESET ROLE;

SELECT pg_temp.set_jwt('22222222-2222-4222-8222-222222222222', 'authenticated');
SET ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM public.products WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0,
  'user B cannot read user A products'
);
UPDATE public.products
   SET user_id = '22222222-2222-4222-8222-222222222222'
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
RESET ROLE;
SELECT is(
  (
    SELECT user_id::text
      FROM public.products
     WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  '11111111-1111-4111-8111-111111111111',
  'USING hides the row so product takeover leaves the owner unchanged'
);
SELECT pg_temp.clear_jwt();

-- 2.3 secrets: tenancy through products
SELECT pg_temp.set_jwt('11111111-1111-4111-8111-111111111111', 'authenticated');
SET ROLE authenticated;
INSERT INTO public.secrets (id, product_id, key_name, ciphertext, nonce)
VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'sk_live',
  pg_temp.bytes(32),
  pg_temp.bytes(24)
);
RESET ROLE;

SELECT pg_temp.set_jwt('22222222-2222-4222-8222-222222222222', 'authenticated');
SET ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM public.secrets),
  0,
  'user B cannot read user A secrets'
);
SELECT throws_ok(
  $$INSERT INTO public.secrets (product_id, key_name, ciphertext, nonce)
    VALUES (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'stolen',
      decode(repeat('ab', 32), 'hex'),
      decode(repeat('ab', 24), 'hex')
    )$$,
  '42501',
  NULL,
  'user B cannot insert into user A product'
);
RESET ROLE;
SELECT pg_temp.clear_jwt();

-- 2.4 shared_links constraints (CHECK fires for the table owner too)
SELECT throws_ok(
  $$INSERT INTO public.shared_links (
      owner_id, token_hash, payload_ciphertext, payload_nonce, wrapped_sdek,
      recipient_blind_index, recipient_ciphertext, item_count, expires_at, max_views
    ) VALUES (
      '11111111-1111-4111-8111-111111111111',
      decode(repeat('ab', 32), 'hex'),
      decode(repeat('ab', 40), 'hex'),
      decode(repeat('ab', 24), 'hex'),
      decode(repeat('ab', 48), 'hex'),
      decode(repeat('ab', 32), 'hex'),
      decode(repeat('ab', 40), 'hex'),
      1, now() + interval '1 hour', 0
    )$$,
  '23514',
  NULL,
  'max_views 0 is rejected'
);
SELECT throws_ok(
  $$INSERT INTO public.shared_links (
      owner_id, token_hash, payload_ciphertext, payload_nonce, wrapped_sdek,
      recipient_blind_index, recipient_ciphertext, item_count, expires_at, max_views
    ) VALUES (
      '11111111-1111-4111-8111-111111111111',
      decode(repeat('cd', 32), 'hex'),
      decode(repeat('ab', 40), 'hex'),
      decode(repeat('ab', 24), 'hex'),
      decode(repeat('ab', 48), 'hex'),
      decode(repeat('ab', 32), 'hex'),
      decode(repeat('ab', 40), 'hex'),
      1, now() + interval '1 hour', 21
    )$$,
  '23514',
  NULL,
  'max_views 21 is rejected'
);
SELECT throws_ok(
  $$INSERT INTO public.shared_links (
      owner_id, token_hash, payload_ciphertext, payload_nonce, wrapped_sdek,
      recipient_blind_index, recipient_ciphertext, item_count, expires_at, max_views
    ) VALUES (
      '11111111-1111-4111-8111-111111111111',
      decode(repeat('ef', 32), 'hex'),
      decode(repeat('ab', 40), 'hex'),
      decode(repeat('ab', 23), 'hex'),
      decode(repeat('ab', 48), 'hex'),
      decode(repeat('ab', 32), 'hex'),
      decode(repeat('ab', 40), 'hex'),
      1, now() + interval '1 hour', 3
    )$$,
  '23514',
  NULL,
  'nonce not 24 bytes is rejected'
);
SELECT throws_ok(
  $$INSERT INTO public.shared_links (
      owner_id, token_hash, payload_ciphertext, payload_nonce, wrapped_sdek,
      recipient_blind_index, recipient_ciphertext, item_count, expires_at, max_views
    ) VALUES (
      '11111111-1111-4111-8111-111111111111',
      decode(repeat('11', 32), 'hex'),
      decode(repeat('ab', 40), 'hex'),
      decode(repeat('ab', 24), 'hex'),
      decode(repeat('ab', 48), 'hex'),
      decode(repeat('ab', 32), 'hex'),
      decode(repeat('ab', 40), 'hex'),
      1, now() + interval '40 days', 3
    )$$,
  '23514',
  NULL,
  'expiry beyond 30 days is rejected'
);

SELECT pg_temp.set_jwt('11111111-1111-4111-8111-111111111111', 'authenticated');
SET ROLE authenticated;
INSERT INTO public.shared_links (
  id, owner_id, token_hash, payload_ciphertext, payload_nonce, wrapped_sdek,
  recipient_blind_index, recipient_ciphertext, item_count, expires_at, max_views
) VALUES (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '11111111-1111-4111-8111-111111111111',
  pg_temp.bytes(32),
  pg_temp.bytes(40),
  pg_temp.bytes(24),
  pg_temp.bytes(48),
  pg_temp.bytes(32),
  pg_temp.bytes(40),
  1,
  now() + interval '2 hours',
  3
);
RESET ROLE;

SELECT pg_temp.set_jwt('22222222-2222-4222-8222-222222222222', 'authenticated');
SET ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM public.shared_links),
  0,
  'user B cannot list user A shares'
);
SELECT throws_ok(
  $$SELECT payload_ciphertext FROM public.shared_links$$,
  '42501',
  NULL,
  'payload_ciphertext is not granted to authenticated'
);
RESET ROLE;
SELECT pg_temp.clear_jwt();

-- 2.5 share_verifications: no grants
INSERT INTO public.share_verifications (share_link_id, code_hash, expires_at)
VALUES (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  pg_temp.bytes(32),
  now() + interval '10 minutes'
);
SELECT pg_temp.set_jwt('11111111-1111-4111-8111-111111111111', 'authenticated');
SET ROLE authenticated;
SELECT throws_ok(
  $$SELECT id FROM public.share_verifications$$,
  '42501',
  NULL,
  'authenticated cannot select share_verifications'
);
RESET ROLE;
SELECT pg_temp.clear_jwt();

-- 2.6 audit_log append-only
INSERT INTO public.audit_log (
  user_id, event_type, actor, payload, prev_hash, entry_hash
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  'test',
  '{}'::jsonb,
  '{}'::jsonb,
  pg_temp.bytes(32),
  pg_temp.bytes(32)
);
SELECT throws_ok(
  $$UPDATE public.audit_log SET event_type = 'tamper'$$,
  'P0001',
  NULL,
  'audit_log UPDATE is blocked'
);
SELECT throws_ok(
  $$DELETE FROM public.audit_log$$,
  'P0001',
  NULL,
  'audit_log DELETE is blocked'
);

SELECT pg_temp.set_jwt('22222222-2222-4222-8222-222222222222', 'authenticated');
SET ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM public.audit_log),
  0,
  'user B cannot read user A audit rows'
);
RESET ROLE;
SELECT pg_temp.clear_jwt();

-- 2.8 consume_share: authenticated cannot execute; service_role can; budget holds
SELECT pg_temp.set_jwt('11111111-1111-4111-8111-111111111111', 'authenticated');
SET ROLE authenticated;
SELECT throws_ok(
  $$SELECT * FROM public.consume_share('cccccccc-cccc-4ccc-8ccc-cccccccccccc')$$,
  '42501',
  NULL,
  'authenticated cannot execute consume_share'
);
RESET ROLE;
SELECT pg_temp.clear_jwt();

INSERT INTO public.shared_links (
  id, owner_id, token_hash, payload_ciphertext, payload_nonce, wrapped_sdek,
  recipient_blind_index, recipient_ciphertext, item_count, expires_at, max_views
) VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  '11111111-1111-4111-8111-111111111111',
  decode(repeat('22', 32), 'hex'),
  pg_temp.bytes(40),
  pg_temp.bytes(24),
  pg_temp.bytes(48),
  pg_temp.bytes(32),
  pg_temp.bytes(40),
  1,
  now() + interval '2 hours',
  1
);
SET ROLE service_role;
SELECT * FROM public.consume_share('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
RESET ROLE;
SELECT pass('service_role can execute consume_share');

SELECT lives_ok(
  $$SELECT * FROM public.consume_share('cccccccc-cccc-4ccc-8ccc-cccccccccccc')$$,
  'first consume succeeds'
);
SELECT lives_ok(
  $$SELECT * FROM public.consume_share('cccccccc-cccc-4ccc-8ccc-cccccccccccc')$$,
  'second consume succeeds'
);
SELECT lives_ok(
  $$SELECT * FROM public.consume_share('cccccccc-cccc-4ccc-8ccc-cccccccccccc')$$,
  'third consume succeeds'
);
SELECT throws_ok(
  $$SELECT * FROM public.consume_share('cccccccc-cccc-4ccc-8ccc-cccccccccccc')$$,
  'P0002',
  NULL,
  'fourth consume is SHARE_UNAVAILABLE'
);
SELECT is(
  (SELECT view_count FROM public.shared_links WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  3,
  'view_count stops at max_views'
);

-- 0009 rotate_wrapped_keys only touches the caller
SELECT pg_temp.set_jwt('22222222-2222-4222-8222-222222222222', 'authenticated');
SET ROLE authenticated;
INSERT INTO public.user_keys (
  user_id, wrapped_vault_key, wrapped_private_key, public_key, kdf_params
) VALUES (
  '22222222-2222-4222-8222-222222222222',
  pg_temp.bytes(48),
  pg_temp.bytes(48),
  pg_temp.bytes(32),
  pg_temp.kdf_ok()
);
SELECT public.rotate_wrapped_keys(
  decode(repeat('cd', 48), 'hex'),
  decode(repeat('cd', 48), 'hex'),
  pg_temp.kdf_ok()
);
RESET ROLE;
SELECT is(
  (SELECT key_version FROM public.user_keys WHERE user_id = '11111111-1111-4111-8111-111111111111'),
  1,
  'rotate_wrapped_keys does not bump another user key_version'
);
SELECT is(
  (SELECT key_version FROM public.user_keys WHERE user_id = '22222222-2222-4222-8222-222222222222'),
  2,
  'rotate_wrapped_keys bumps the caller key_version'
);

-- 2.9 indexes exist
SELECT has_index('public', 'products', 'idx_products_user', 'idx_products_user exists');
SELECT has_index('public', 'products', 'idx_products_id_user', 'idx_products_id_user exists');
SELECT has_index('public', 'secrets', 'idx_secrets_product', 'idx_secrets_product exists');
SELECT has_index('public', 'shared_links', 'idx_shares_token', 'idx_shares_token exists');

CREATE FUNCTION pg_temp.explain_secret_join() RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  rec record;
  out text := '';
BEGIN
  FOR rec IN
    EXECUTE $q$
      EXPLAIN SELECT s.id
        FROM public.secrets s
        JOIN public.products p ON p.id = s.product_id
       WHERE p.id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
         AND p.user_id = '11111111-1111-4111-8111-111111111111'
    $q$
  LOOP
    out := out || rec."QUERY PLAN" || E'\n';
  END LOOP;
  RETURN out;
END $$;

SELECT ok(
  pg_temp.explain_secret_join() ILIKE '%idx_products_id_user%'
    OR pg_temp.explain_secret_join() ILIKE '%Index Scan%',
  'secrets RLS join can use an index'
);

SELECT * FROM finish();
ROLLBACK;
