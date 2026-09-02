-- 0011_vault_key_rpcs.sql
-- Phase 3: owner can read wraps only through SECURITY DEFINER RPCs.
-- Column grants on user_keys still omit wrapped columns.

ALTER TABLE public.user_keys
  ADD COLUMN IF NOT EXISTS recovery_ack_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_own_keys()
RETURNS TABLE (
  wrapped_vault_key            bytea,
  wrapped_private_key          bytea,
  public_key                   bytea,
  kdf_params                   jsonb,
  recovery_wrapped_vault_key   bytea,
  recovery_wrapped_private_key bytea,
  key_version                  int,
  recovery_ack_at              timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
    SELECT
      uk.wrapped_vault_key,
      uk.wrapped_private_key,
      uk.public_key,
      uk.kdf_params,
      uk.recovery_wrapped_vault_key,
      uk.recovery_wrapped_private_key,
      uk.key_version,
      uk.recovery_ack_at
    FROM public.user_keys uk
   WHERE uk.user_id = v_uid;
END $$;

REVOKE ALL ON FUNCTION public.get_own_keys() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_keys() TO authenticated;

CREATE OR REPLACE FUNCTION public.ack_recovery_kit()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;
  UPDATE public.user_keys
     SET recovery_ack_at = coalesce(recovery_ack_at, now())
   WHERE user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_KEYS' USING ERRCODE = 'P0002';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.ack_recovery_kit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ack_recovery_kit() TO authenticated;

-- Unauthenticated KDF lookup. Unknown emails get the same default JSON as a real row.
CREATE OR REPLACE FUNCTION public.kdf_params_for_email(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v jsonb;
  v_default jsonb := '{"alg":"argon2id","m":65536,"t":3,"p":1,"v":1}'::jsonb;
BEGIN
  SELECT uk.kdf_params
    INTO v
    FROM public.user_keys uk
    JOIN auth.users u ON u.id = uk.user_id
   WHERE lower(u.email) = lower(trim(p_email));
  RETURN coalesce(v, v_default);
END $$;

REVOKE ALL ON FUNCTION public.kdf_params_for_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kdf_params_for_email(text) TO anon, authenticated;
