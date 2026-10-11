-- 0014_rollback.sql
-- Drops the helpers only. Repaired wraps stay repaired: rewriting them back into the JSON form
-- would make those products unreadable again.
DROP FUNCTION IF EXISTS public.repair_legacy_json_wraps();
DROP FUNCTION IF EXISTS public.legacy_json_bytes(bytea);
