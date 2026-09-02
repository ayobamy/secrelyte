import { NextResponse } from 'next/server';
import { SignupRequest } from '@/contracts/vault';
import { b64urlToBytes } from '@/lib/b64url';
import { bytesToPgHex } from '@/lib/bytea';
import {
  isEmailTakenError,
  isMissingRpcError,
  readErrorBits,
  signupConfirmsEmail,
} from '@/lib/signup-errors';
import { createAdminSupabase } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

function lenOk(bytes: Uint8Array, expected: number): boolean {
  return bytes.byteLength === expected;
}

async function rollbackUser(
  admin: ReturnType<typeof createAdminSupabase>,
  userId: string,
): Promise<void> {
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch {
    // Auth errors from supabase-js expose `message` as a getter. Swallow.
  }
}

type Admin = ReturnType<typeof createAdminSupabase>;

async function storeKeys(
  admin: Admin,
  row: {
    user_id: string;
    wrapped_vault_key: string;
    wrapped_private_key: string;
    public_key: string;
    recovery_wrapped_vault_key: string;
    recovery_wrapped_private_key: string;
    kdf_params: unknown;
  },
): Promise<{ ok: true } | { ok: false; bits: ReturnType<typeof readErrorBits> }> {
  const rpc = await admin.rpc('store_signup_keys', {
    p_user_id: row.user_id,
    p_wrapped_vault_key: row.wrapped_vault_key,
    p_wrapped_private_key: row.wrapped_private_key,
    p_public_key: row.public_key,
    p_recovery_wrapped_vault_key: row.recovery_wrapped_vault_key,
    p_recovery_wrapped_private_key: row.recovery_wrapped_private_key,
    p_kdf_params: row.kdf_params,
  });
  if (!rpc.error) return { ok: true };
  const bits = readErrorBits(rpc.error);
  if (!isMissingRpcError(bits)) return { ok: false, bits };
  const inserted = await admin.from('user_keys').insert({
    user_id: row.user_id,
    wrapped_vault_key: row.wrapped_vault_key,
    wrapped_private_key: row.wrapped_private_key,
    public_key: row.public_key,
    recovery_wrapped_vault_key: row.recovery_wrapped_vault_key,
    recovery_wrapped_private_key: row.recovery_wrapped_private_key,
    kdf_params: row.kdf_params,
  });
  if (!inserted.error) return { ok: true };
  return { ok: false, bits: readErrorBits(inserted.error) };
}

export async function POST(req: Request) {
  try {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
    }
    const parsed = SignupRequest.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
    }
    const body = parsed.data;
    const publicKey = b64urlToBytes(body.publicKey);
    const wrappedVaultKey = b64urlToBytes(body.wrappedVaultKey);
    const wrappedPrivateKey = b64urlToBytes(body.wrappedPrivateKey);
    const recoveryVk = b64urlToBytes(body.recoveryWrappedVaultKey);
    const recoverySk = b64urlToBytes(body.recoveryWrappedPrivateKey);
    if (
      !lenOk(publicKey, 32) ||
      wrappedVaultKey.byteLength < 40 ||
      wrappedPrivateKey.byteLength < 40 ||
      recoveryVk.byteLength < 40 ||
      recoverySk.byteLength < 40
    ) {
      return NextResponse.json({ error: 'INVALID_KEY_LENGTH' }, { status: 400 });
    }

    const admin = createAdminSupabase();
    const confirm = signupConfirmsEmail();
    const created = await admin.auth.admin.createUser({
      email: body.email,
      password: body.authPassword,
      email_confirm: confirm,
    });
    if (created.error || !created.data.user) {
      const bits = readErrorBits(created.error);
      if (isEmailTakenError(bits)) {
        return NextResponse.json({ error: 'EMAIL_TAKEN' }, { status: 409 });
      }
      return NextResponse.json({ error: 'SIGNUP_FAILED' }, { status: 400 });
    }
    const userId = created.data.user.id;
    const stored = await storeKeys(admin, {
      user_id: userId,
      wrapped_vault_key: bytesToPgHex(wrappedVaultKey),
      wrapped_private_key: bytesToPgHex(wrappedPrivateKey),
      public_key: bytesToPgHex(publicKey),
      recovery_wrapped_vault_key: bytesToPgHex(recoveryVk),
      recovery_wrapped_private_key: bytesToPgHex(recoverySk),
      kdf_params: body.kdf,
    });
    if (!stored.ok) {
      console.error('signup: keys write failed', stored.bits.code, stored.bits.message);
      await rollbackUser(admin, userId);
      return NextResponse.json({ error: 'KEYS_FAILED' }, { status: 500 });
    }
    return NextResponse.json({
      userId,
      confirmRequired: !confirm,
    });
  } catch (err) {
    if (err && typeof err === 'object' && 'issues' in err) {
      const issues = (err as { issues: { path: unknown[] }[] }).issues;
      console.error('signup: env', issues.map((i) => i.path.join('.')).join(','));
    } else {
      const bits = readErrorBits(err);
      console.error('signup: unexpected', bits.code, bits.message);
    }
    return NextResponse.json({ error: 'SIGNUP_FAILED' }, { status: 500 });
  }
}
