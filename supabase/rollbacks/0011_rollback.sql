-- 0011_rollback.sql
DROP FUNCTION IF EXISTS public.kdf_params_for_email(text);
DROP FUNCTION IF EXISTS public.ack_recovery_kit();
DROP FUNCTION IF EXISTS public.get_own_keys();
ALTER TABLE public.user_keys DROP COLUMN IF EXISTS recovery_ack_at;
