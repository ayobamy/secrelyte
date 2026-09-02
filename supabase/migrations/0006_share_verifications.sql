-- 0006_share_verifications.sql

CREATE TABLE public.share_verifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id uuid NOT NULL REFERENCES public.shared_links(id) ON DELETE CASCADE,
  code_hash     bytea NOT NULL CHECK (octet_length(code_hash) = 32),
  attempts      int NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.share_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_verifications FORCE ROW LEVEL SECURITY;
-- No grants to anon or authenticated at all. service_role only, via functions.

CREATE INDEX idx_verif_link ON public.share_verifications (share_link_id);
CREATE INDEX idx_verif_exp ON public.share_verifications (expires_at);
