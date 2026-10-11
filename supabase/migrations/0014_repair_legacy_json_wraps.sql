-- 0014_repair_legacy_json_wraps.sql
-- Earlier builds sent product wraps to the bytea column as a raw Uint8Array, which supabase-js
-- serializes as the JSON text of an index-keyed object: {"0":62,"1":218,...}. The real wrap
-- bytes are intact inside that JSON. This rebuilds them. Rows already holding real bytes are
-- left alone, and so is anything that is not exactly that JSON shape.
--
-- Only products.wrapped_dek was affected: secrets could not be written while the product wrap
-- was unreadable, and the signup and password-change paths always sent hex.
--
-- jsonb keeps the last of duplicate keys, so a crafted {"0":1,"0":2,"1":3} decodes as 2 bytes.
-- That is accepted: the database is outside the trust boundary, and the client authenticates
-- every wrap (XChaCha20-Poly1305) before use, so any crafted row reads as tampered.

CREATE OR REPLACE FUNCTION public.legacy_json_bytes(p_raw bytea)
RETURNS bytea
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_obj   jsonb;
  v_count int;
  v_hex   text;
BEGIN
  -- {"0":
  IF p_raw IS NULL OR substring(p_raw FROM 1 FOR 5) <> '\x7b2230223a'::bytea THEN
    RETURN NULL;
  END IF;

  v_obj := convert_from(p_raw, 'UTF8')::jsonb;
  IF jsonb_typeof(v_obj) <> 'object' THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_count FROM jsonb_each(v_obj);

  -- Keys must be exactly 0..n-1 and every value a byte. CASE guards each cast.
  IF EXISTS (
    SELECT 1
      FROM jsonb_each(v_obj) AS e
     WHERE CASE WHEN e.key ~ '^(0|[1-9][0-9]{0,8})$' THEN e.key::int >= v_count ELSE true END
        OR CASE WHEN jsonb_typeof(e.value) = 'number' AND e.value::text ~ '^[0-9]{1,3}$'
                THEN e.value::text::int > 255
                ELSE true END
  ) THEN
    RETURN NULL;
  END IF;

  SELECT string_agg(lpad(to_hex(e.value::text::int), 2, '0'), '' ORDER BY e.key::int)
    INTO v_hex
    FROM jsonb_each(v_obj) AS e;

  RETURN decode(v_hex, 'hex');
EXCEPTION
  -- Not UTF-8, not JSON: not a legacy wrap.
  WHEN others THEN
    RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.legacy_json_bytes(bytea) FROM PUBLIC, anon, authenticated;

-- The repair, as a function so supabase/tests/04_legacy_json_bytes.sql can run it over a table
-- holding legacy, healthy and look-alike rows. Returns how many rows it rebuilt. Safe to run
-- again: a repaired row no longer parses as the legacy shape.
--
-- products has FORCE ROW LEVEL SECURITY. The migration role bypasses RLS; if it ever stops
-- doing so, row_security = off makes the update fail loudly instead of updating 0 rows.
CREATE OR REPLACE FUNCTION public.repair_legacy_json_wraps()
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
SET row_security = off
AS $$
DECLARE
  v_repaired integer;
BEGIN
  UPDATE public.products
     SET wrapped_dek = public.legacy_json_bytes(wrapped_dek)
   WHERE public.legacy_json_bytes(wrapped_dek) IS NOT NULL;
  GET DIAGNOSTICS v_repaired = ROW_COUNT;
  RETURN v_repaired;
END $$;

REVOKE ALL ON FUNCTION public.repair_legacy_json_wraps()
  FROM PUBLIC, anon, authenticated, service_role;

SELECT public.repair_legacy_json_wraps();
