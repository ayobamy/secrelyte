'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toB64url } from '@/services/crypto';
import {
  assembleSignupMaterial,
  authPasswordFor,
  scorePassword,
  unlockFromOwnKeys,
  unlockKeys,
  type SignupMaterial,
} from '@/services/vault';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { PasswordField } from '@/components/password-field';
import { signupUserMessage, unlockUserMessage } from '@/lib/signup-errors';

type Kit = SignupMaterial['kit'] & { email: string };

let pendingKit: Kit | null = null;
let pendingKeys: { vk: SignupMaterial['vk']; sk: SignupMaterial['sk'] } | null = null;

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const strength = password ? scorePassword(password) : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const scored = scorePassword(password);
    if (!scored.ok) {
      setError(scored.reason);
      return;
    }
    setBusy(true);
    try {
      const material = await assembleSignupMaterial(email, password);
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: material.email,
          authPassword: material.authPassword,
          publicKey: await toB64url(material.publicKey),
          wrappedVaultKey: await toB64url(material.wrappedVaultKey),
          wrappedPrivateKey: await toB64url(material.wrappedPrivateKey),
          recoveryWrappedVaultKey: await toB64url(material.recoveryWrappedVaultKey),
          recoveryWrappedPrivateKey: await toB64url(material.recoveryWrappedPrivateKey),
          kdf: material.kdf,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        confirmRequired?: boolean;
      };
      if (!res.ok) {
        setError(signupUserMessage(json.error));
        return;
      }
      pendingKit = { ...material.kit, email: material.email };
      pendingKeys = { vk: material.vk, sk: material.sk };
      if (!json.confirmRequired) {
        const supabase = createBrowserSupabase();
        await supabase.auth.signInWithPassword({
          email: material.email,
          password: material.authPassword,
        });
        unlockKeys(material.vk, material.sk);
      }
      router.push('/vault');
    } catch {
      setError('Signup failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm font-medium">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-line bg-base px-4 py-3"
        />
      </label>
      <PasswordField
        label="Password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        required
        minLength={12}
      />
      {strength ? (
        <p className="text-sm text-muted">
          Strength {strength.score}/4{strength.reason ? ` · ${strength.reason}` : ''}
        </p>
      ) : null}
      {error ? <p className="text-sm text-exposed-ink">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-ink px-5 py-3 text-paper disabled:opacity-50"
      >
        {busy ? 'Deriving keys…' : 'Create vault'}
      </button>
      <p className="text-sm text-muted">
        Already have one? <Link href="/login">Unlock</Link>
      </p>
    </form>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const kdfRes = await fetch('/api/kdf-params', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const kdf = (await kdfRes.json()) as { m?: number; t?: number; p?: number; v?: 1 };
      const authPassword = await authPasswordFor(email, password, kdf);
      const supabase = createBrowserSupabase();
      const signed = await supabase.auth.signInWithPassword({ email, password: authPassword });
      if (signed.error) {
        setError(unlockUserMessage(signed.error));
        return;
      }
      const keys = await supabase.rpc('get_own_keys');
      const row = Array.isArray(keys.data) ? keys.data[0] : keys.data;
      if (!row) {
        setError('No keys on this account.');
        return;
      }
      await unlockFromOwnKeys(email, password, row, kdf);
      router.push('/vault');
    } catch {
      setError('Unlock failed. Wrong password unwraps locally, not on the server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm font-medium">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-line bg-base px-4 py-3"
        />
      </label>
      <PasswordField
        label="Password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        required
      />
      {error ? <p className="text-sm text-exposed-ink">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-ink px-5 py-3 text-paper disabled:opacity-50"
      >
        {busy ? 'Unlocking…' : 'Unlock'}
      </button>
      <p className="text-sm text-muted">
        New here? <Link href="/signup">Create a vault</Link>
      </p>
    </form>
  );
}

export function takePendingKit(): Kit | null {
  const kit = pendingKit;
  pendingKit = null;
  return kit;
}

export function takePendingKeys() {
  const keys = pendingKeys;
  pendingKeys = null;
  return keys;
}
