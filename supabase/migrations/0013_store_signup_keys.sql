-- 0013_store_signup_keys.sql
-- Signup must not depend on PostgREST table DML for wrap columns.
-- store_signup_keys runs as owner (BYPASSRLS) and is executable only by service_role.
-- Re-GRANT user_keys in case 0012 never landed on the hosted project.

GRANT USAGE ON SCHEMA public TO service_role;
GRANT INSERT, SELECT, DELETE ON public.user_keys TO service_role;

CREATE OR REPLACE FUNCTION public.store_signup_keys(
  p_user_id uuid,
  p_wrapped_vault_key bytea,
  p_wrapped_private_key bytea,
  p_public_key bytea,
  p_recovery_wrapped_vault_key bytea,
  p_recovery_wrapped_private_key bytea,
  p_kdf_params jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF octet_length(p_public_key) <> 32
     OR octet_length(p_wrapped_vault_key) < 40
     OR octet_length(p_wrapped_private_key) < 40
     OR octet_length(p_recovery_wrapped_vault_key) < 40
     OR octet_length(p_recovery_wrapped_private_key) < 40 THEN
    RAISE EXCEPTION 'INVALID_KEY_LENGTH' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_keys (
    user_id,
    wrapped_vault_key,
    wrapped_private_key,
    public_key,
    recovery_wrapped_vault_key,
    recovery_wrapped_private_key,
    kdf_params
  ) VALUES (
    p_user_id,
    p_wrapped_vault_key,
    p_wrapped_private_key,
    p_public_key,
    p_recovery_wrapped_vault_key,
    p_recovery_wrapped_private_key,
    p_kdf_params
  );
END $$;

REVOKE ALL ON FUNCTION public.store_signup_keys(uuid, bytea, bytea, bytea, bytea, bytea, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_signup_keys(uuid, bytea, bytea, bytea, bytea, bytea, jsonb)
  TO service_role;

NOTIFY pgrst, 'reload schema';
