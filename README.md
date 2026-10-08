# Secrelyte

Zero-knowledge secrets manager. The server stores ciphertext. The model never sees plaintext.

## Status

Built: foundation, crypto core, data layer with RLS, and the vault (signup, recovery kit,
unlock, store, reveal, password change). Not built yet: sharing, the agent, and the audit log.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm run start
```

Local loop uses the `start` script after a build, or the package.json script named for the Next.js watcher.

Gates: `pnpm verify:phase0`, then `pnpm build && pnpm check:bundle && pnpm test:e2e`.

The vault specs (signup, no plaintext egress, reveal and clipboard timing) need a backend and
skip without one. Run them against local Supabase, which needs Docker:

```bash
pnpm exec supabase start
pnpm test:e2e:vault   # resets the local database, builds, runs the full e2e suite
```

Do not put `SUPABASE_SECRET_KEY` in a `NEXT_PUBLIC_` variable. That key bypasses RLS.
