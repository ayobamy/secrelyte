import { beforeEach, describe, expect, it, vi } from 'vitest';

const createUser = vi.fn();
const deleteUser = vi.fn();
const insert = vi.fn();
const rpc = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    auth: { admin: { createUser, deleteUser } },
    from: () => ({ insert }),
    rpc,
  }),
}));

import { POST } from '@/app/api/signup/route';

const body = {
  email: 'owner@example.com',
  authPassword: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  publicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  wrappedVaultKey: 'A'.repeat(64),
  wrappedPrivateKey: 'A'.repeat(64),
  recoveryWrappedVaultKey: 'A'.repeat(64),
  recoveryWrappedPrivateKey: 'A'.repeat(64),
  kdf: { alg: 'argon2id' as const, m: 65536, t: 3, p: 1, v: 1 as const },
};

function req(payload: unknown = body) {
  return new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

describe('POST /api/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores wraps via store_signup_keys as Postgres hex', async () => {
    createUser.mockResolvedValue({
      data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
      error: null,
    });
    rpc.mockResolvedValue({ error: null });
    const res = await POST(req());
    expect(res.status).toBe(200);
    const args = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(rpc.mock.calls[0]?.[0]).toBe('store_signup_keys');
    expect(args.p_public_key).toMatch(/^\\x[0-9a-f]+$/);
    expect(args.p_wrapped_vault_key).toMatch(/^\\x[0-9a-f]+$/);
    expect(args.p_wrapped_vault_key).not.toBeInstanceOf(Uint8Array);
    expect(insert).not.toHaveBeenCalled();
    const createdArg = createUser.mock.calls[0]?.[0] as { email_confirm?: boolean };
    expect(createdArg.email_confirm).toBe(true);
    await expect(res.json()).resolves.toMatchObject({ confirmRequired: false });
  });

  it('falls back to table insert when the RPC is missing from the schema cache', async () => {
    createUser.mockResolvedValue({
      data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
      error: null,
    });
    rpc.mockResolvedValue({ error: { code: 'PGRST202', message: 'Could not find the function' } });
    insert.mockResolvedValue({ error: null });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalled();
  });

  it('returns JSON 500 when key insert fails and does not throw', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    createUser.mockResolvedValue({
      data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
      error: null,
    });
    rpc.mockResolvedValue({
      error: {
        code: '42501',
        get message() {
          return 'permission denied';
        },
      },
    });
    deleteUser.mockResolvedValue({ error: null });
    const res = await POST(req());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'KEYS_FAILED' });
    expect(deleteUser).toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('returns 409 EMAIL_TAKEN when GoTrue already has the email', async () => {
    createUser.mockResolvedValue({
      data: { user: null },
      error: {
        code: 'email_exists',
        status: 422,
        get message() {
          return 'A user with this email address has already been registered';
        },
      },
    });
    const res = await POST(req());
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: 'EMAIL_TAKEN' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns JSON 500 when supabase throws a getter-only error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const thrown = {};
    Object.defineProperty(thrown, 'message', { get: () => 'boom', set: undefined });
    createUser.mockRejectedValue(thrown);
    const res = await POST(req());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'SIGNUP_FAILED' });
  });
});
