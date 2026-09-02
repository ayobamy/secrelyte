-- 0005_shared_links.sql

CREATE TABLE public.shared_links (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash            bytea NOT NULL UNIQUE,
  payload_ciphertext    bytea NOT NULL,
  payload_nonce         bytea NOT NULL,
  wrapped_sdek          bytea NOT NULL,
  passphrase_salt       bytea,
  recipient_blind_index bytea NOT NULL,
  recipient_ciphertext  bytea NOT NULL,
  item_count            int  NOT NULL,
  expires_at            timestamptz NOT NULL,
  max_views             int  NOT NULL DEFAULT 3,
  view_count            int  NOT NULL DEFAULT 0,
  revoked_at            timestamptz,
  locked_at             timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_token_hash CHECK (octet_length(token_hash) = 32),
  CONSTRAINT chk_blind_idx  CHECK (octet_length(recipient_blind_index) = 32),
  CONSTRAINT chk_nonce      CHECK (octet_length(payload_nonce) = 24),
  CONSTRAINT chk_psalt      CHECK (passphrase_salt IS NULL OR octet_length(passphrase_salt) = 16),
  CONSTRAINT chk_views      CHECK (view_count >= 0 AND view_count <= max_views),
  CONSTRAINT chk_max_views  CHECK (max_views BETWEEN 1 AND 20),
  CONSTRAINT chk_expiry     CHECK (expires_at > created_at),
  CONSTRAINT chk_horizon    CHECK (expires_at <= created_at + interval '30 days'),
  CONSTRAINT chk_size       CHECK (octet_length(payload_ciphertext) <= 262144),
  CONSTRAINT chk_items      CHECK (item_count BETWEEN 1 AND 50)
);

ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_links FORCE ROW LEVEL SECURITY;

-- Owners manage their own links. Nobody reads payloads through RLS.
GRANT SELECT (id, owner_id, recipient_ciphertext, item_count, expires_at,
              max_views, view_count, revoked_at, locked_at, created_at)
  ON public.shared_links TO authenticated;
GRANT INSERT, UPDATE ON public.shared_links TO authenticated;

CREATE POLICY shares_own ON public.shared_links
  FOR ALL TO authenticated
  USING      (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE INDEX idx_shares_token ON public.shared_links (token_hash);
CREATE INDEX idx_shares_owner ON public.shared_links (owner_id, created_at DESC)
  WHERE revoked_at IS NULL;
CREATE INDEX idx_shares_expiry ON public.shared_links (expires_at)
  WHERE revoked_at IS NULL;
