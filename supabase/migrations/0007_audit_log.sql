-- 0007_audit_log.sql

CREATE TABLE public.audit_log (
  id            bigserial PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type    text NOT NULL,
  resource_type text,
  resource_id   uuid,
  actor         jsonb NOT NULL,
  payload       jsonb NOT NULL,
  prev_hash     bytea NOT NULL CHECK (octet_length(prev_hash) = 32),
  entry_hash    bytea NOT NULL CHECK (octet_length(entry_hash) = 32),
  created_at    timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.audit_log TO authenticated;

CREATE POLICY audit_own_read ON public.audit_log
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.audit_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only (attempted %)', TG_OP;
END $$;

CREATE TRIGGER audit_no_mutate
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_immutable();

CREATE INDEX idx_audit_user_time ON public.audit_log (user_id, created_at DESC);
CREATE INDEX idx_audit_resource ON public.audit_log (resource_type, resource_id);
