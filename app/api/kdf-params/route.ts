import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { getClientEnv } from '@/lib/env';
import { KDF_LOOKUP_FLOOR_MS } from '@/contracts/vault';

export const runtime = 'nodejs';

const Body = z.object({
  email: z.string().email(),
});

const DEFAULT_KDF = { alg: 'argon2id', m: 65536, t: 3, p: 1, v: 1 } as const;

export async function POST(req: Request) {
  const started = Date.now();
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  const parsed = Body.safeParse(json);
  const email = parsed.success ? parsed.data.email : 'nobody@invalid.invalid';
  const env = getClientEnv();
  const anon = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data } = await anon.rpc('kdf_params_for_email', { p_email: email });
  const wait = KDF_LOOKUP_FLOOR_MS - (Date.now() - started);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  return NextResponse.json(data ?? DEFAULT_KDF);
}
