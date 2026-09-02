# supabase/

Postgres schema for Secrelyte. Implements `docs/technical/04-data-model-and-rls.md`.

**Owns:** migrations, RLS, `consume_share`, `rotate_wrapped_keys`, cleanup cron.
**Does not own:** application authorization, share-session cookies, crypto.
**Contracts:** none. Callers use PostgREST / RPCs after a user JWT.

## Verify

```bash
pnpm test:rls                 # needs Docker + `supabase start`
pnpm exec vitest run evals/schema-invariants.eval.ts
```

Destructive rollbacks that drop ciphertext tables:

```bash
SECRELYTE_CONFIRM_DESTRUCTIVE_ROLLBACK=1 \
  bash scripts/rollback-migration.sh supabase/rollbacks/0004_rollback.sql
```

Do not apply these to production from this session without an explicit go-ahead.
