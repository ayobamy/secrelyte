-- 0012_rollback.sql
REVOKE INSERT, SELECT, DELETE ON public.user_keys FROM service_role;
