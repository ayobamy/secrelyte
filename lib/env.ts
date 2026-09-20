import { z } from 'zod';

/**
 * Client-safe env surface. This module is reachable from `'use client'` code, so it must
 * never name a server secret, not even inside a comment: the bundle gate greps the built
 * output for those names. The server half lives in `lib/env.server.ts` behind `server-only`.
 *
 * Enforced by evals/bundle-boundary.eval.ts and scripts/check-bundle-secrets.sh.
 */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith('sb_publishable_'),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

function readClientRaw() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  };
}

export function getClientEnv(): ClientEnv {
  return clientEnvSchema.parse(readClientRaw());
}

export function supabaseOriginFromUrl(url: string): string {
  return new URL(url).origin;
}
