# Secrelyte

Zero-knowledge secrets manager. The server stores ciphertext. The model never sees plaintext.

## Phase 0

Foundation only: Next.js App Router, contracts, service skeletons, CI, security headers.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm run start
```

Local loop uses the `start` script after a build, or the package.json script named for the Next.js watcher.

Gates: `pnpm verify:phase0`, then `pnpm build && pnpm check:bundle && pnpm test:e2e`.

Do not put `SUPABASE_SECRET_KEY` in a `NEXT_PUBLIC_` variable. That key bypasses RLS.
