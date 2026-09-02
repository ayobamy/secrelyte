-- 0004_secrets.sql

CREATE TABLE public.secrets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  key_name    text NOT NULL CHECK (length(key_name) BETWEEN 1 AND 120),
  ciphertext  bytea NOT NULL CHECK (octet_length(ciphertext) BETWEEN 17 AND 65536),
  nonce       bytea NOT NULL CHECK (octet_length(nonce) = 24),
  aad_version int  NOT NULL DEFAULT 1,
  version     int  NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, key_name)
);

ALTER TABLE public.secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secrets FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.secrets TO authenticated;

CREATE POLICY secrets_own ON public.secrets
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = secrets.product_id AND p.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = secrets.product_id AND p.user_id = (SELECT auth.uid())));

CREATE INDEX idx_secrets_product ON public.secrets (product_id);
