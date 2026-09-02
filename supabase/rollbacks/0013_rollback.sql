-- 0013_rollback.sql
DROP FUNCTION IF EXISTS public.store_signup_keys(uuid, bytea, bytea, bytea, bytea, bytea, jsonb);
NOTIFY pgrst, 'reload schema';
