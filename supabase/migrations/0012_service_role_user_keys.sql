-- 0012_service_role_user_keys.sql
-- Signup writes keys with the secret key (service_role). auto_expose_new_tables = false
-- so DML is not inherited. Without INSERT, POST /api/signup cannot store wraps.

GRANT INSERT, SELECT, DELETE ON public.user_keys TO service_role;
