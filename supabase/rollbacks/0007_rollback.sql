DROP TRIGGER IF EXISTS audit_no_mutate ON public.audit_log;
DROP FUNCTION IF EXISTS public.audit_immutable();
DROP TABLE IF EXISTS public.audit_log;
