'use client';

import { useEffect, useMemo, useState } from 'react';
import { AuthenticationError } from '@/services/crypto';
import {
  AuthUpdatePendingError,
  CLIPBOARD_CLEAR_MS,
  applyPasswordChange,
  assertKeysAbsentFromWebStorage,
  buildRecoveryKitPdf,
  bytesFromWire,
  bytesToPgHex,
  discardDek,
  downloadBytes,
  isUnlocked,
  lockKeys,
  openProductDek,
  openSecretValue,
  phraseMatchesCurrentVault,
  pickChallengeIndices,
  retryAuthPasswordUpdate,
  scorePassword,
  sealSecretValue,
  startIdleLock,
  subscribeUnlocked,
  unlockKeys,
  verifyChallenge,
  wrapNewProductDek,
} from '@/services/vault';
import { takePendingKit as takeKit, takePendingKeys as takeKeys } from '@/components/auth-forms';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { SiteHeader } from '@/components/site-header';
import { VaultComposer } from '@/components/vault-composer';
import { LockedVault } from '@/components/locked-vault';
import { LightField } from '@/components/light-field';
import { PasswordField } from '@/components/password-field';
import { formatRevealSeconds, revealRemaining } from '@/lib/reveal-timer';

function wallNow(): number {
  return Date.now();
}

type ProductRow = {
  id: string;
  name: string;
  wrapped_dek: unknown;
  environment: string;
};

type SecretRow = {
  id: string;
  product_id: string;
  key_name: string;
  ciphertext: unknown;
  nonce: unknown;
  version: number;
};

export function VaultApp() {
  const [unlocked, setUnlocked] = useState(isUnlocked());
  const [kit, setKit] = useState(() => takeKit());
  const [downloaded, setDownloaded] = useState(false);
  const [acked, setAcked] = useState(false);
  const [phraseAck, setPhraseAck] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [needsPhrase, setNeedsPhrase] = useState(false);
  const [recoveryWrap, setRecoveryWrap] = useState<unknown>(null);
  const [phrase, setPhrase] = useState('');
  const [kitError, setKitError] = useState<string | null>(null);
  const challenge = useMemo(() => (kit ? pickChallengeIndices(kit.words.length, 3) : []), [kit]);

  useEffect(() => {
    const unsub = subscribeUnlocked(() => setUnlocked(isUnlocked()));
    const stopIdle = startIdleLock();
    queueMicrotask(() => {
      const keys = takeKeys();
      if (keys) unlockKeys(keys.vk, keys.sk);
      assertKeysAbsentFromWebStorage();
    });
    return () => {
      stopIdle();
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!unlocked || kit) return;
    void (async () => {
      const supabase = createBrowserSupabase();
      const keys = await supabase.rpc('get_own_keys');
      const row = Array.isArray(keys.data) ? keys.data[0] : keys.data;
      if (row && row.recovery_ack_at == null) {
        setNeedsPhrase(true);
        setRecoveryWrap(row.recovery_wrapped_vault_key);
      }
    })();
  }, [unlocked, kit]);

  async function downloadKit() {
    if (!kit) return;
    const pdf = await buildRecoveryKitPdf({
      email: kit.email,
      phrase: kit.phrase,
      base32: kit.base32,
      createdAt: new Date(),
    });
    downloadBytes('secrelyte-recovery-kit.pdf', pdf, 'application/pdf');
    setDownloaded(true);
  }

  async function confirmKit(e: React.FormEvent) {
    e.preventDefault();
    if (!kit || !downloaded || !phraseAck) return;
    const ok = verifyChallenge(
      kit.words,
      challenge.map((index) => ({ index, value: answers[index] ?? '' })),
    );
    if (!ok) {
      setKitError('Those three words do not match the kit.');
      return;
    }
    const supabase = createBrowserSupabase();
    await supabase.rpc('ack_recovery_kit');
    setAcked(true);
    setKit(null);
  }

  async function confirmStoredPhrase(e: React.FormEvent) {
    e.preventDefault();
    setKitError(null);
    const ok = await phraseMatchesCurrentVault(phrase, recoveryWrap);
    if (!ok) {
      setKitError('That phrase does not open this vault.');
      return;
    }
    const supabase = createBrowserSupabase();
    await supabase.rpc('ack_recovery_kit');
    setAcked(true);
    setNeedsPhrase(false);
  }

  if (kit && !acked) {
    return (
      <div className="flex min-h-full flex-col">
        <SiteHeader variant="app" current="vault" />
        <main id="content" className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
          <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">Blocking</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Recovery kit</h1>
          <p className="mt-4 text-[17px] leading-7 text-muted">
            Secrelyte cannot recover this vault. Download the PDF, store it, then type three words
            from it.
          </p>
          <button
            type="button"
            onClick={() => void downloadKit()}
            className="mt-8 rounded-full bg-ink px-5 py-3 text-paper"
          >
            Download PDF
          </button>
          <form onSubmit={(e) => void confirmKit(e)} className="mt-10 space-y-4">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={phraseAck}
                onChange={(e) => setPhraseAck(e.target.checked)}
                className="mt-1"
              />
              I stored this somewhere safe. Secrelyte cannot recover my data without it.
            </label>
            {challenge.map((index) => (
              <label key={index} className="block text-sm font-medium">
                Word {index + 1}
                <input
                  value={answers[index] ?? ''}
                  onChange={(e) => setAnswers((s) => ({ ...s, [index]: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-line bg-base px-4 py-3 font-mono"
                />
              </label>
            ))}
            {kitError ? <p className="text-sm text-exposed-ink">{kitError}</p> : null}
            <button
              type="submit"
              disabled={!downloaded || !phraseAck}
              className="rounded-full bg-ink px-5 py-3 text-paper disabled:opacity-40"
            >
              Open the vault
            </button>
          </form>
        </main>
      </div>
    );
  }

  if (needsPhrase && !acked) {
    return (
      <div className="flex min-h-full flex-col">
        <SiteHeader variant="app" current="vault" />
        <main id="content" className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
          <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">Blocking</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Recovery kit</h1>
          <p className="mt-4 text-[17px] leading-7 text-muted">
            This vault has no kit acknowledgement. Type the 24-word phrase from your printed sheet.
          </p>
          <form onSubmit={(e) => void confirmStoredPhrase(e)} className="mt-10 space-y-4">
            <label className="block text-sm font-medium">
              24-word phrase
              <textarea
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-2xl border border-line bg-base px-4 py-3 font-mono text-sm"
              />
            </label>
            {kitError ? <p className="text-sm text-exposed-ink">{kitError}</p> : null}
            <button type="submit" className="rounded-full bg-ink px-5 py-3 text-paper">
              Confirm kit
            </button>
          </form>
        </main>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="relative flex min-h-full flex-col">
        <LightField />
        <SiteHeader variant="app" current="vault" />
        <main id="content" className="flex-1">
          <LockedVault />
        </main>
      </div>
    );
  }

  return <UnlockedVault />;
}

function UnlockedVault() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [secrets, setSecrets] = useState<SecretRow[]>([]);
  const [productName, setProductName] = useState('Production');
  const [secretName, setSecretName] = useState('api_key');
  const [secretValue, setSecretValue] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pendingAuth, setPendingAuth] = useState(false);
  const pwStrength = newPassword ? scorePassword(newPassword) : null;
  const remaining = startedAt === null ? 0 : revealRemaining(startedAt, now);
  const revealed = revealedValue !== null && remaining > 0 ? revealedValue : null;

  useEffect(() => {
    const supabase = createBrowserSupabase();
    void Promise.all([
      supabase.from('products').select('id,name,wrapped_dek,environment'),
      supabase.from('secrets').select('id,product_id,key_name,ciphertext,nonce,version'),
    ]).then(([p, s]) => {
      setProducts((p.data ?? []) as ProductRow[]);
      setSecrets((s.data ?? []) as SecretRow[]);
      setSelected((current) => current ?? p.data?.[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (startedAt === null) return;
    const id = window.setInterval(() => {
      const t = wallNow();
      if (revealRemaining(startedAt, t) === 0) {
        setStartedAt(null);
        setRevealedValue(null);
        return;
      }
      setNow(t);
    }, 250);
    return () => window.clearInterval(id);
  }, [startedAt]);

  function startReveal(value: string) {
    const t = wallNow();
    setNow(t);
    setStartedAt(t);
    setRevealedValue(value);
  }

  async function refresh() {
    const supabase = createBrowserSupabase();
    const p = await supabase.from('products').select('id,name,wrapped_dek,environment');
    const s = await supabase
      .from('secrets')
      .select('id,product_id,key_name,ciphertext,nonce,version');
    setProducts((p.data ?? []) as ProductRow[]);
    setSecrets((s.data ?? []) as SecretRow[]);
    setSelected((current) => current ?? p.data?.[0]?.id ?? null);
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createBrowserSupabase();
    const session = await supabase.auth.getUser();
    const userId = session.data.user?.id;
    if (!userId) return;
    const id = crypto.randomUUID();
    const { dek, wrapped } = await wrapNewProductDek(id);
    await supabase.from('products').insert({
      id,
      user_id: userId,
      name: productName,
      wrapped_dek: wrapped,
      environment: 'production',
    });
    await discardDek(dek);
    await refresh();
  }

  async function addSecret(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const product = products.find((p) => p.id === selected);
    if (!product) return;
    const id = crypto.randomUUID();
    const dek = await openProductDek(product.id, product.wrapped_dek);
    const sealed = await sealSecretValue({
      dek,
      productId: product.id,
      secretId: id,
      version: 1,
      value: secretValue,
    });
    const supabase = createBrowserSupabase();
    await supabase.from('secrets').insert({
      id,
      product_id: product.id,
      key_name: secretName,
      ciphertext: sealed.ciphertext,
      nonce: sealed.nonce,
      version: 1,
    });
    await discardDek(dek);
    setSecretValue('');
    await refresh();
  }

  async function reveal(secret: SecretRow) {
    try {
      const product = products.find((p) => p.id === secret.product_id);
      if (!product) return;
      const dek = await openProductDek(product.id, product.wrapped_dek);
      const value = await openSecretValue({
        dek,
        productId: product.id,
        secretId: secret.id,
        version: secret.version,
        ciphertext: bytesFromWire(secret.ciphertext),
        nonce: bytesFromWire(secret.nonce),
      });
      await discardDek(dek);
      startReveal(value);
    } catch (err) {
      setError(
        err instanceof AuthenticationError
          ? 'Tamper warning. This ciphertext did not authenticate.'
          : 'Reveal failed.',
      );
    }
  }

  async function copyRevealed() {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed);
    window.setTimeout(() => {
      void navigator.clipboard.writeText('');
    }, CLIPBOARD_CLEAR_MS);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPwMsg(null);
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const supabase = createBrowserSupabase();
    const session = await supabase.auth.getUser();
    const email = session.data.user?.email;
    if (!email) return;
    try {
      await applyPasswordChange({
        email,
        newPassword,
        rotateWrapped: async (args) => {
          const { error: rpcError } = await supabase.rpc('rotate_wrapped_keys', {
            p_wrapped_vault_key: bytesToPgHex(args.wrappedVaultKey),
            p_wrapped_private_key: bytesToPgHex(args.wrappedPrivateKey),
            p_kdf_params: args.kdf,
          });
          if (rpcError) throw rpcError;
        },
        updateAuthPassword: async (authPassword) => {
          const { error: authError } = await supabase.auth.updateUser({ password: authPassword });
          if (authError) throw authError;
          await supabase.auth.signOut({ scope: 'others' });
        },
      });
      setPendingAuth(false);
      setPwMsg('Password updated. Other sessions were signed out.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err instanceof AuthUpdatePendingError) {
        setPendingAuth(true);
        setError('Wraps saved. Retry to finish the login-key update.');
      } else {
        setError(err instanceof Error ? err.message : 'Password change failed.');
      }
    }
  }

  async function retryPasswordAuth() {
    setError(null);
    const supabase = createBrowserSupabase();
    try {
      await retryAuthPasswordUpdate(async (authPassword) => {
        const { error: authError } = await supabase.auth.updateUser({ password: authPassword });
        if (authError) throw authError;
        await supabase.auth.signOut({ scope: 'others' });
      });
      setPendingAuth(false);
      setPwMsg('Login key updated. Other sessions were signed out.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed.');
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader variant="app" current="vault" />
      <main id="content" className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6">
        <div className="flex flex-1 flex-col pt-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">
                This device
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">Vault</h1>
            </div>
            <button
              type="button"
              onClick={() => void lockKeys()}
              className="font-mono text-[11px] text-sealed-ink"
            >
              lock
            </button>
          </div>

          <form onSubmit={(e) => void addProduct(e)} className="mt-10 flex gap-2">
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="flex-1 rounded-2xl border border-line bg-base px-4 py-2"
              aria-label="Product name"
            />
            <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm text-paper">
              Add product
            </button>
          </form>

          <ul className="mt-6 space-y-2">
            {products.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelected(p.id)}
                  className={selected === p.id ? 'font-semibold' : 'text-muted'}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <form onSubmit={(e) => void addSecret(e)} className="mt-8 space-y-3">
              <input
                value={secretName}
                onChange={(e) => setSecretName(e.target.value)}
                aria-label="Secret name"
                className="w-full rounded-2xl border border-line bg-base px-4 py-2 font-mono text-sm"
              />
              <input
                value={secretValue}
                onChange={(e) => setSecretValue(e.target.value)}
                aria-label="Secret value"
                className="w-full rounded-2xl border border-line bg-base px-4 py-2 font-mono text-sm"
              />
              <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm text-paper">
                Store ciphertext
              </button>
            </form>
          ) : null}

          <ul className="mt-8 space-y-3">
            {secrets
              .filter((s) => !selected || s.product_id === selected)
              .map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 border-t border-line pt-3"
                >
                  <span className="font-mono text-sm">{s.key_name}</span>
                  <button type="button" onClick={() => void reveal(s)} className="text-sm text-ink">
                    Reveal for 30s
                  </button>
                </li>
              ))}
          </ul>

          {revealed ? (
            <div className="mt-8 rounded-2xl border border-line bg-paper p-4">
              <p className="font-mono text-sm break-all">{revealed}</p>
              <div className="mt-3 flex gap-3 text-sm">
                <button type="button" onClick={() => void copyRevealed()}>
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStartedAt(null);
                    setRevealedValue(null);
                  }}
                >
                  Hide now
                </button>
                <span className="text-muted">{formatRevealSeconds(remaining)}</span>
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-4 text-sm text-exposed-ink">{error}</p> : null}
          {pwMsg ? <p className="mt-4 text-sm text-muted">{pwMsg}</p> : null}

          {products.length === 0 ? (
            <div className="flex flex-1 flex-col justify-center py-16">
              <p className="max-w-md text-[17px] leading-7 text-muted">
                Empty. Paste a messy block. Ciphertext only leaves the browser.
              </p>
            </div>
          ) : null}

          <form
            onSubmit={(e) => void changePassword(e)}
            className="mt-12 space-y-3 border-t border-line pt-8"
          >
            <p className="text-sm font-medium">Change password</p>
            <p className="text-sm text-muted">
              Wraps first, then the login key. Recovery kit stays valid.
            </p>
            <PasswordField
              label="New password"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              inputClassName="rounded-2xl border border-line bg-base px-4 py-2 pr-12"
            />
            <PasswordField
              label="Confirm"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              revealNoun="confirmation"
              inputClassName="rounded-2xl border border-line bg-base px-4 py-2 pr-12"
            />
            {pwStrength ? (
              <p className="text-sm text-muted">
                Strength {pwStrength.score}/4{pwStrength.reason ? ` · ${pwStrength.reason}` : ''}
              </p>
            ) : null}
            <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm text-paper">
              Rotate wraps
            </button>
            {pendingAuth ? (
              <button
                type="button"
                onClick={() => void retryPasswordAuth()}
                className="ml-2 text-sm text-ink"
              >
                Retry login-key update
              </button>
            ) : null}
          </form>
        </div>
        <div className="sticky bottom-0 z-10 bg-gradient-to-t from-base from-60% to-transparent pb-6 pt-8">
          <VaultComposer />
        </div>
      </main>
    </div>
  );
}
