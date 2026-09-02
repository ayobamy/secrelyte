-- 0009_atomic_password_rotation.sql
-- Application order: call this FIRST, then update the GoTrue password.
-- Reverse order bricks the vault.

CREATE OR REPLACE FUNCTION public.rotate_wrapped_keys(
  p_wrapped_vault_key   bytea,
  p_wrapped_private_key bytea,
  p_kdf_params          jsonb
) RETURNS void
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
     SET wrapped_vault_key   = p_wrapped_vault_key,
         wrapped_private_key = p_wrapped_private_key,
         kdf_params          = p_kdf_params,
         key_version         = key_version + 1,
         updated_at          = now()
   WHERE user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_KEYS' USING ERRCODE = 'P0002';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.rotate_wrapped_keys(bytea, bytea, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_wrapped_keys(bytea, bytea, jsonb) TO authenticated;
