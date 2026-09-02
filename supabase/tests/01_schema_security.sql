-- supabase/tests/01_schema_security.sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(3);

SELECT is(
  (
    SELECT count(*)::int
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)
  ),
  0,
  'every public table has RLS enabled and forced'
);

SELECT is(
  (
    SELECT count(*)::int
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef
       AND NOT EXISTS (
         SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) cfg
          WHERE cfg LIKE 'search_path=%'
       )
  ),
  0,
  'every SECURITY DEFINER function pins search_path'
);

SELECT is(
  (
    SELECT count(*)::int
      FROM information_schema.role_table_grants
     WHERE grantee = 'anon' AND table_schema = 'public'
  ),
  0,
  'anon has zero table grants in public'
);

SELECT * FROM finish();
ROLLBACK;
