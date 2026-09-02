-- 0003_products.sql

CREATE TYPE public.environment AS ENUM ('production', 'staging', 'development');

CREATE TABLE public.products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  login_url   text CHECK (login_url IS NULL OR login_url ~ '^https?://'),
  username    text CHECK (username IS NULL OR length(username) <= 200),
  environment public.environment NOT NULL DEFAULT 'development',
  wrapped_dek bytea NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;

CREATE POLICY products_own ON public.products
  FOR ALL TO authenticated
  USING      (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE INDEX idx_products_user ON public.products (user_id, created_at DESC);
CREATE INDEX idx_products_id_user ON public.products (id, user_id);
