import { z } from 'zod';

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith('sb_publishable_'),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().startsWith('sb_secret_'),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-').optional(),
  RESEND_API_KEY: z.string().startsWith('re_').optional(),
  RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
  SHARE_SESSION_SECRET: z
    .string()
    .length(64)
    .regex(/^[0-9a-fA-F]+$/, 'must be 32 bytes hex')
    .optional(),
  EMAIL_BLIND_INDEX_PEPPER: z
    .string()
    .length(64)
    .regex(/^[0-9a-fA-F]+$/, 'must be 32 bytes hex')
    .optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type AppEnv = ServerEnv & ClientEnv;

function readClientRaw() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  };
}

export const supabaseAdminEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().startsWith('sb_secret_'),
});
export type SupabaseAdminEnv = z.infer<typeof supabaseAdminEnvSchema>;

export function getClientEnv(): ClientEnv {
  return clientEnvSchema.parse(readClientRaw());
}

/** URL + secret key only. Signup must not parse Phase 4 peppers. */
export function getSupabaseAdminEnv(): SupabaseAdminEnv {
  return supabaseAdminEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
}

export function getServerEnv(): AppEnv {
  const client = getClientEnv();
  const server = serverEnvSchema.parse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
    SHARE_SESSION_SECRET: process.env.SHARE_SESSION_SECRET,
    EMAIL_BLIND_INDEX_PEPPER: process.env.EMAIL_BLIND_INDEX_PEPPER,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return { ...server, ...client };
}

export function supabaseOriginFromUrl(url: string): string {
  return new URL(url).origin;
}
