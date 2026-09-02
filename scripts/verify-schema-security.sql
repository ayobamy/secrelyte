-- Fails the session if any public table lacks RLS+FORCE, any SECURITY DEFINER
-- function is unpinned, or anon has table grants. Run as a superuser after reset.

DO $$
DECLARE
  unsecured text;
  unpinned text;
  anon_grants text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
    INTO unsecured
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity);

  IF unsecured IS NOT NULL THEN
    RAISE EXCEPTION 'RLS not enabled and forced: %', unsecured;
  END IF;

  SELECT string_agg(p.proname, ', ' ORDER BY p.proname)
    INTO unpinned
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prosecdef
     AND NOT EXISTS (
       SELECT 1
         FROM unnest(coalesce(p.proconfig, '{}')) cfg
        WHERE cfg LIKE 'search_path=%'
     );

  IF unpinned IS NOT NULL THEN
    RAISE EXCEPTION 'SECURITY DEFINER without search_path: %', unpinned;
  END IF;

  SELECT string_agg(table_name || ':' || privilege_type, ', ' ORDER BY table_name)
    INTO anon_grants
    FROM information_schema.role_table_grants
   WHERE grantee = 'anon' AND table_schema = 'public';

  IF anon_grants IS NOT NULL THEN
    RAISE EXCEPTION 'anon table grants: %', anon_grants;
  END IF;
END $$;
