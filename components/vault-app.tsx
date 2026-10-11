'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AuthenticationError } from '@/services/crypto';
import {
  AuthUpdatePendingError,
  CLIPBOARD_CLEAR_MS,
  applyPasswordChange,
  assertKeysAbsentFromWebStorage,
  browserClipboardDeps,
  buildRecoveryKitPdf,
  bytesFromWire,
  bytesToPgHex,
  createClipboardGuard,
  createProductWrap,
  downloadBytes,
  isUnlocked,
  lockKeys,
  productInsertRow,
  secretInsertRow,
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
  withProductDek,
  type ClipboardGuard,
  type ClipboardState,
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

function productKeyError(err: unknown, tamper: string, fallback: string): string {
  return err instanceof AuthenticationError ? tamper : fallback;
}

const CLIPBOARD_MESSAGE: Record<ClipboardState, string> = {
  idle: '',
  // "Tries": a browser can refuse a write that no click asked for, and the message then
  // switches to clear-pending. Nothing here promises a clear the browser decides.
  holding: `Copied. Secrelyte tries to clear the clipboard in ${CLIPBOARD_CLEAR_MS / 1000} seconds while this tab is open.`,
  'clear-pending':
    'The clipboard still holds the secret. Clear it now. Secrelyte also retries when you return to this tab.',
  cleared: 'Clipboard cleared.',
};

/**
 * The clipboard's status, and a way to clear it by hand. A click counts as user activation,
 * which some browsers require for any clipboard write, so the button works even where the
 * timed clear is refused.
 */
function ClipboardNotice({ clip, onClear }: { clip: ClipboardState; onClear: () => void }) {
  return (
    <>
      <p
        role="status"
        className={`mt-4 text-sm empty:mt-0 ${clip === 'clear-pending' ? 'text-exposed-ink' : 'text-muted'}`}
      >
        {CLIPBOARD_MESSAGE[clip]}
      </p>
      {clip === 'holding' || clip === 'clear-pending' ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-2 text-sm font-medium text-ink underline decoration-line underline-offset-4"
        >
          Clear clipboard now
        </button>
      ) : null}
    </>
  );
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
  // The vault stays shut until get_own_keys confirms the kit was acknowledged.
  const [gate, setGate] = useState<'checking' | 'phrase' | 'open' | 'failed'>('checking');
  const [recoveryWrap, setRecoveryWrap] = useState<unknown>(null);
  const [phrase, setPhrase] = useState('');
  const [kitError, setKitError] = useState<string | null>(null);
  // Above the lock boundary, so locking can clear a copied secret and the notice survives it.
  const [clip, setClip] = useState<ClipboardState>('idle');
  const clipboard = useRef<ClipboardGuard | null>(null);
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
    const guard = createClipboardGuard(browserClipboardDeps(), setClip);
    clipboard.current = guard;
    return () => {
      void guard.clearNow();
    };
  }, []);

  useEffect(() => {
    if (!unlocked) void clipboard.current?.clearNow();
  }, [unlocked]);

  function clearClipboard() {
    void clipboard.current?.clearNow();
  }

  function copyToClipboard(value: string): Promise<void> {
    return clipboard.current
      ? clipboard.current.copy(value)
      : Promise.reject(new Error('CLIPBOARD_UNAVAILABLE'));
  }

  useEffect(() => {
    if (!unlocked || kit || acked) return;
    void (async () => {
      const supabase = createBrowserSupabase();
      const keys = await supabase.rpc('get_own_keys');
      const row = Array.isArray(keys.data) ? keys.data[0] : keys.data;
      // Fail closed: an error, or an unlocked session with no key row, keeps the vault shut.
      if (keys.error || !row) {
        setGate('failed');
        return;
      }
      if (row.recovery_ack_at == null) {
        setRecoveryWrap(row.recovery_wrapped_vault_key);
        setGate('phrase');
        return;
      }
      setGate('open');
    })();
  }, [unlocked, kit, acked]);

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
    const { error: ackError } = await supabase.rpc('ack_recovery_kit');
    if (ackError) {
      setKitError('Could not record that you stored the kit. Check your connection and try again.');
      return;
    }
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
    const { error: ackError } = await supabase.rpc('ack_recovery_kit');
    if (ackError) {
      setKitError('Could not record the confirmation. Check your connection and try again.');
      return;
    }
    setAcked(true);
    setGate('open');
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
            {kitError ? (
              <p role="alert" className="text-sm text-exposed-ink">
                {kitError}
              </p>
            ) : null}
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

  if (unlocked && gate === 'phrase' && !acked) {
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
            {kitError ? (
              <p role="alert" className="text-sm text-exposed-ink">
                {kitError}
              </p>
            ) : null}
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
          {clip !== 'idle' ? (
            <div className="mx-auto w-full max-w-2xl px-6 pt-8">
              <ClipboardNotice clip={clip} onClear={clearClipboard} />
            </div>
          ) : null}
          <LockedVault />
        </main>
      </div>
    );
  }

  if (!acked && gate !== 'open') {
    return (
      <div className="flex min-h-full flex-col">
        <SiteHeader variant="app" current="vault" />
        <main
          id="content"
          aria-busy={gate === 'checking'}
          className="mx-auto w-full max-w-xl flex-1 px-6 py-16"
        >
          <h1 className="text-3xl font-semibold tracking-tight">Vault</h1>
          {gate === 'failed' ? (
            <p role="alert" className="mt-4 text-[17px] leading-7 text-exposed-ink">
              Could not check your recovery kit, so the vault stays closed. Reload to try again.
            </p>
          ) : (
            <p role="status" className="mt-4 text-sm text-muted">
              Checking your recovery kit.
            </p>
          )}
        </main>
      </div>
    );
  }

  return (
    <UnlockedVault clip={clip} copyToClipboard={copyToClipboard} clearClipboard={clearClipboard} />
  );
}

function UnlockedVault({
  clip,
  copyToClipboard,
  clearClipboard,
}: {
  clip: ClipboardState;
  copyToClipboard: (value: string) => Promise<void>;
  clearClipboard: () => void;
}) {
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
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const pwStrength = newPassword ? scorePassword(newPassword) : null;
  const remaining = startedAt === null ? 0 : revealRemaining(startedAt, now);
  const revealed = revealedValue !== null && remaining > 0 ? revealedValue : null;

  useEffect(() => {
    const supabase = createBrowserSupabase();
    void Promise.all([
      supabase.from('products').select('id,name,wrapped_dek,environment'),
      supabase.from('secrets').select('id,product_id,key_name,ciphertext,nonce,version'),
    ]).then(([p, s]) => {
      // A failed read must not render as an empty vault: that looks like data loss.
      if (p.error || s.error) {
        setLoadState('failed');
        return;
      }
      setProducts((p.data ?? []) as ProductRow[]);
      setSecrets((s.data ?? []) as SecretRow[]);
      setSelected((current) => current ?? p.data?.[0]?.id ?? null);
      setLoadState('ready');
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
    if (p.error || s.error) {
      setError('Saved, but the list could not reload. Reload the page to see it.');
      return;
    }
    setProducts((p.data ?? []) as ProductRow[]);
    setSecrets((s.data ?? []) as SecretRow[]);
    setSelected((current) => current ?? p.data?.[0]?.id ?? null);
    setLoadState('ready');
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createBrowserSupabase();
    const session = await supabase.auth.getUser();
    const userId = session.data.user?.id;
    if (!userId) {
      setError('Your session ended. Unlock again to add a product.');
      return;
    }
    const id = crypto.randomUUID();
    try {
      const wrapped = await createProductWrap(id);
      const { error: insertError } = await supabase.from('products').insert(
        productInsertRow({
          id,
          userId,
          name: productName,
          environment: 'production',
          wrappedDek: wrapped,
        }),
      );
      if (insertError) {
        setError('Could not save the product. Nothing was stored.');
        return;
      }
      await refresh();
    } catch {
      setError('Could not save the product. Nothing was stored.');
    }
  }

  async function addSecret(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const product = products.find((p) => p.id === selected);
    if (!product) {
      setError('Add or pick a product first.');
      return;
    }
    const id = crypto.randomUUID();
    try {
      // The DEK is live only while sealing; it is zeroed before the network insert.
      const sealed = await withProductDek(product.id, product.wrapped_dek, (dek) =>
        sealSecretValue({
          dek,
          productId: product.id,
          secretId: id,
          version: 1,
          value: secretValue,
        }),
      );
      const { error: insertError } = await createBrowserSupabase()
        .from('secrets')
        .insert(
          secretInsertRow({
            id,
            productId: product.id,
            keyName: secretName,
            version: 1,
            ciphertext: sealed.ciphertext,
            nonce: sealed.nonce,
          }),
        );
      if (insertError) {
        // The value stays in the box so the paste is not lost.
        setError('Could not store the secret. Nothing was saved.');
        return;
      }
      setSecretValue('');
      await refresh();
    } catch (err) {
      setError(
        productKeyError(
          err,
          'Tamper warning. This product key did not authenticate.',
          'Could not store the secret. Nothing was saved.',
        ),
      );
    }
  }

  async function reveal(secret: SecretRow) {
    setError(null);
    const product = products.find((p) => p.id === secret.product_id);
    if (!product) {
      setError('Reveal failed.');
      return;
    }
    try {
      const value = await withProductDek(product.id, product.wrapped_dek, (dek) =>
        openSecretValue({
          dek,
          productId: product.id,
          secretId: secret.id,
          version: secret.version,
          ciphertext: bytesFromWire(secret.ciphertext),
          nonce: bytesFromWire(secret.nonce),
        }),
      );
      startReveal(value);
    } catch (err) {
      setError(
        productKeyError(
          err,
          'Tamper warning. This ciphertext did not authenticate.',
          'Reveal failed.',
        ),
      );
    }
  }

  async function copyRevealed() {
    if (!revealed) return;
    try {
      await copyToClipboard(revealed);
    } catch {
      setError('Could not copy. Select the value and copy it by hand.');
    }
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
    if (!email) {
      setError('Your session ended. Unlock again to change the password.');
      return;
    }
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
            <div className="mt-8 rounded-2xl border border-exposed bg-paper p-4">
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

          <ClipboardNotice clip={clip} onClear={clearClipboard} />

          {loadState === 'failed' ? (
            <p role="alert" className="mt-8 text-sm text-exposed-ink">
              Could not load your vault. Reload to try again.
            </p>
          ) : null}

          {error ? <p className="mt-4 text-sm text-exposed-ink">{error}</p> : null}
          {pwMsg ? <p className="mt-4 text-sm text-muted">{pwMsg}</p> : null}

          {loadState === 'ready' && products.length === 0 ? (
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
