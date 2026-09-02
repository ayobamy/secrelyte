-- 0002_user_keys.sql

CREATE TABLE public.user_keys (
  user_id                      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  wrapped_vault_key            bytea NOT NULL,
  wrapped_private_key          bytea NOT NULL,
  public_key                   bytea NOT NULL,
  kdf_params                   jsonb NOT NULL,
  recovery_wrapped_vault_key   bytea,
  recovery_wrapped_private_key bytea,
  key_version                  int   NOT NULL DEFAULT 1,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_pubkey CHECK (octet_length(public_key) = 32),
  CONSTRAINT chk_kdf CHECK (
    kdf_params ? 'alg' AND kdf_params ? 'm' AND
    kdf_params ? 't'   AND kdf_params ? 'p' AND
    (kdf_params->>'m')::int >= 19456
  )
);

ALTER TABLE public.user_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_keys FORCE ROW LEVEL SECURITY;

-- Column grants are evaluated before RLS. Only these two columns are readable by others.
GRANT SELECT (user_id, public_key) ON public.user_keys TO authenticated;
-- Owner writes (signup / rotation). SELECT of wrapped columns stays unggranted so
-- public_read cannot leak them. Phase 3 reads wraps through a SECURITY DEFINER RPC.
GRANT INSERT, UPDATE, DELETE ON public.user_keys TO authenticated;

CREATE POLICY user_keys_own ON public.user_keys
  FOR ALL TO authenticated
  USING      (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY user_keys_public_read ON public.user_keys
  FOR SELECT TO authenticated USING (true);
