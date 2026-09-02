-- 0008_consume_share.sql

CREATE OR REPLACE FUNCTION public.consume_share(p_share_id uuid)
RETURNS TABLE (
  payload_ciphertext bytea,
  payload_nonce bytea,
  wrapped_sdek bytea,
  passphrase_salt bytea
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v public.shared_links%ROWTYPE;
BEGIN
  UPDATE public.shared_links
     SET view_count = view_count + 1
   WHERE id = p_share_id
     AND revoked_at IS NULL
     AND locked_at IS NULL
     AND expires_at > now()
     AND view_count < max_views
  RETURNING * INTO v;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARE_UNAVAILABLE' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
    SELECT v.payload_ciphertext, v.payload_nonce, v.wrapped_sdek, v.passphrase_salt;
END $$;

REVOKE ALL ON FUNCTION public.consume_share(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_share(uuid) TO service_role;
