'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AuthenticationError } from '@/services/crypto';
import {
  AuthUpdatePendingError,
  IDLE_LOCK_MS,
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
import {
  clearPendingKit,
  peekPendingKit,
  takePendingKeys as takeKeys,
} from '@/components/auth-forms';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { describeThrown } from '@/lib/signup-errors';
import { AppFooter, AuthShell, Card, CardBody, CardFactBand } from '@/components/auth-shell';
import { SiteHeader } from '@/components/site-header';
import { LockedVault } from '@/components/locked-vault';
import { PhraseCheckScreen, RecoveryKitScreen } from '@/components/recovery-kit';
import { PasswordPanel, ProductForm, SecretForm } from '@/components/vault-forms';
import {
  ClipboardNotice,
  EmptyProducts,
  KeyRow,
  NoKeys,
  ProductHeader,
  ProductList,
  RowsSkeleton,
} from '@/components/vault-parts';
import {
  ArrowDot,
  Eyebrow,
  InlineAlert,
  LOCK_BUTTON,
  PRIMARY_BUTTON,
  SMALL_INK,
  StateDot,
} from '@/components/ui';
import { revealRemaining } from '@/lib/reveal-timer';

function wallNow(): number {
  return Date.now();
}

function productKeyError(err: unknown, tamper: string, fallback: string): string {
  return err instanceof AuthenticationError ? tamper : fallback;
}

const IDLE_MINUTES = IDLE_LOCK_MS / 60_000;

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

/** Where a failure renders: beside the form or row that caused it. */
type ErrorSlot = 'product' | 'secret' | 'workspace' | 'password';

/**
 * Whether this tab holds a session. A read that throws (storage refused) counts as none: the
 * kit screen then points at Unlock, which works, instead of a button that does nothing.
 */
async function hasSession(): Promise<boolean> {
  try {
    const { data } = await createBrowserSupabase().auth.getSession();
    return data.session !== null;
  } catch (err) {
    console.error('vault: session read threw:', describeThrown(err));
    return false;
  }
}

export function VaultApp() {
  const ids = useId();
  const [unlocked, setUnlocked] = useState(isUnlocked());
  const [kit, setKit] = useState(() => peekPendingKit());
  const [downloaded, setDownloaded] = useState(false);
  const [acked, setAcked] = useState(false);
  const [phraseAck, setPhraseAck] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  // The vault stays shut until get_own_keys confirms the kit was acknowledged.
  const [gate, setGate] = useState<'checking' | 'phrase' | 'open' | 'failed'>('checking');
  const [recoveryWrap, setRecoveryWrap] = useState<unknown>(null);
  const [phrase, setPhrase] = useState('');
  const [kitError, setKitError] = useState<string | null>(null);
  const [kitSignedOut, setKitSignedOut] = useState(false);
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

  // Until the PDF is saved the kit exists only in this tab, and a reload or a closed tab would
  // leave an account whose 24 words were never kept. Ask first. (In-app navigation keeps the
  // kit: see peekPendingKit.)
  useEffect(() => {
    if (!kit || downloaded) return;
    const hold = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', hold);
    return () => window.removeEventListener('beforeunload', hold);
  }, [kit, downloaded]);

  // Recording the kit needs a session. Signup goes on to the kit without one when its sign-in
  // failed or the address must be confirmed first, so find out before the three steps.
  useEffect(() => {
    if (!kit) return;
    void hasSession().then((signedIn) => setKitSignedOut(!signedIn));
  }, [kit]);

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
    // Saved: from here a lost tab is recoverable through Unlock and the phrase check.
    clearPendingKit();
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
    // Signup goes on to the kit even when its sign-in failed (see auth-forms.tsx), and with no
    // session the acknowledgement fails on every retry. Say so and point at Unlock instead.
    const signedIn = await hasSession();
    setKitSignedOut(!signedIn);
    if (!signedIn) {
      setKitError(null);
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
      <RecoveryKitScreen
        ids={ids}
        downloaded={downloaded}
        stored={phraseAck}
        challenge={challenge}
        answers={answers}
        error={kitError}
        signedOut={kitSignedOut}
        confirmEmail={kit.confirmEmail}
        onDownload={() => void downloadKit()}
        onStored={setPhraseAck}
        onAnswer={(index, value) => {
          setAnswers((s) => ({ ...s, [index]: value }));
          setKitError(null);
        }}
        onSubmit={(e) => void confirmKit(e)}
      />
    );
  }

  if (unlocked && gate === 'phrase' && !acked) {
    return (
      <PhraseCheckScreen
        ids={ids}
        phrase={phrase}
        error={kitError}
        onPhrase={(value) => {
          setPhrase(value);
          setKitError(null);
        }}
        onSubmit={(e) => void confirmStoredPhrase(e)}
      />
    );
  }

  if (!unlocked) {
    return (
      <LockedVault
        notice={
          clip !== 'idle' ? (
            <ClipboardNotice clip={clip} onClear={clearClipboard} variant="notice" />
          ) : null
        }
      />
    );
  }

  if (!acked && gate !== 'open') {
    return (
      <AuthShell
        header={<SiteHeader variant="app" current="vault" />}
        eyebrow="This device"
        title="Vault"
        lead="One check before the vault opens: that this account's recovery kit was stored."
        busy={gate === 'checking'}
      >
        <Card>
          <CardBody>
            {gate === 'failed' ? (
              <>
                <InlineAlert>
                  Could not check your recovery kit, so the vault stays closed. Reload to try again.
                </InlineAlert>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className={`${PRIMARY_BUTTON} mt-5`}
                >
                  Reload
                  <ArrowDot />
                </button>
                <p className="mt-2.5 text-center text-[13px] leading-5 text-muted">
                  A reload locks the vault. Unlock again and the check runs again.
                </p>
              </>
            ) : (
              <p role="status" className="flex items-center gap-3 text-sm text-muted">
                <span aria-hidden className="spinner text-ink" />
                Checking your recovery kit.
              </p>
            )}
          </CardBody>
          <CardFactBand tone="neutral">The vault stays closed until this check passes</CardFactBand>
        </Card>
      </AuthShell>
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
  const [productName, setProductName] = useState('');
  const [secretName, setSecretName] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  // Which row the value belongs to, so it renders in place, in that key's own row.
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorAt, setErrorAt] = useState<ErrorSlot>('workspace');
  // The slots with an action in flight: the ref answers a second submit at once, the state
  // renders the busy buttons.
  const running = useRef(new Set<ErrorSlot>());
  const [busySlots, setBusySlots] = useState<ReadonlySet<ErrorSlot>>(() => new Set());
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pendingAuth, setPendingAuth] = useState(false);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const ids = useId();
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
      setProductName('');
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
      setSecretName('');
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

  function hideReveal() {
    setStartedAt(null);
    setRevealedValue(null);
  }

  // Switching product re-masks: the countdown would otherwise run on a value no longer in view.
  function selectProduct(id: string) {
    if (id !== selected) hideReveal();
    setSelected(id);
  }

  /**
   * Records which form acted, so its error renders beside it rather than at the top, and runs
   * one action per slot at a time: a second submit would race the first (two products, or a
   * duplicate key answered with "Nothing was saved." beside the row the first one saved).
   */
  function act(slot: ErrorSlot, run: () => Promise<void>, e?: React.FormEvent) {
    if (running.current.has(slot)) {
      e?.preventDefault();
      return;
    }
    running.current.add(slot);
    setBusySlots(new Set(running.current));
    setErrorAt(slot);
    void run().finally(() => {
      running.current.delete(slot);
      setBusySlots(new Set(running.current));
    });
  }

  const errorId = (slot: ErrorSlot) => `${ids}-error-${slot}`;

  function errorFor(slot: ErrorSlot) {
    return error && errorAt === slot ? <InlineAlert id={errorId(slot)}>{error}</InlineAlert> : null;
  }

  /** An edit to a form clears that form's failure, so it never outlives the values it was about. */
  function dismiss(slot: ErrorSlot) {
    if (errorAt === slot) setError(null);
  }

  const selectedProduct = products.find((p) => p.id === selected) ?? null;
  const visibleSecrets = secrets.filter((s) => !selected || s.product_id === selected);
  const empty = loadState === 'ready' && products.length === 0;
  // Not rendered while the vault reads: the form lives in the rail or in the empty state, and
  // moving between the two remounts it, which would drop anything typed in the meantime.
  const productForm =
    loadState === 'loading' ? null : (
      <ProductForm
        id={`${ids}-product-name`}
        value={productName}
        onChange={setProductName}
        onSubmit={(e) => act('product', () => addProduct(e), e)}
        busy={busySlots.has('product')}
        prominent={empty}
        error={errorFor('product')}
        errorId={errorId('product')}
        onEdit={() => dismiss('product')}
      />
    );

  return (
    <div className="app-field flex min-h-full flex-col">
      <SiteHeader
        variant="app"
        current="vault"
        sticky
        action={
          <button type="button" onClick={() => void lockKeys()} className={LOCK_BUTTON}>
            <StateDot tone="attention" />
            Lock
          </button>
        }
      />
      <main
        id="content"
        className="mx-auto w-full max-w-6xl flex-1 px-4 pt-10 pb-14 sm:px-6 sm:pt-12"
      >
        <div className="settle flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <Eyebrow>This device</Eyebrow>
            <h1 className="mt-4 text-[2.5rem] leading-none font-semibold tracking-[-0.045em] text-ink sm:text-5xl">
              Vault
            </h1>
          </div>
          <p className="flex items-center gap-2 font-mono text-[11px] text-muted">
            <StateDot tone="attention" />
            Unlocked on this device
          </p>
        </div>

        <Card className="settle settle-delay-1 mt-7">
          <div className="workspace" data-empty={empty}>
            {empty ? null : (
              <div className="ws-list border-b border-line bg-base lg:border-r lg:border-b-0">
                <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
                  <h2 className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
                    Products
                  </h2>
                  {loadState === 'ready' ? (
                    <span className="font-mono text-[11px] text-muted">{products.length}</span>
                  ) : null}
                </div>
                {loadState === 'loading' ? (
                  <RowsSkeleton rows={2} label="Loading products." />
                ) : null}
                <ProductList
                  products={products.map((p) => ({
                    id: p.id,
                    name: p.name,
                    keys: secrets.filter((s) => s.product_id === p.id).length,
                  }))}
                  selected={selected}
                  onSelect={selectProduct}
                />
              </div>
            )}

            {empty || productForm === null ? null : (
              <div className="ws-add border-t border-line bg-base px-5 pt-4 pb-5 lg:border-r">
                {productForm}
              </div>
            )}

            <div className="ws-pane flex min-w-0 flex-col">
              {loadState === 'failed' ? (
                <div className="p-5 sm:p-6">
                  <InlineAlert>Could not load your vault. Reload to try again.</InlineAlert>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className={`${SMALL_INK} mt-4`}
                  >
                    Reload
                  </button>
                  <p className="mt-2 text-[13px] leading-5 text-muted">
                    A reload locks the vault. Unlock again and it reads your products again.
                  </p>
                </div>
              ) : null}
              {loadState === 'loading' ? <RowsSkeleton rows={3} label="Loading keys." /> : null}
              {empty ? <EmptyProducts>{productForm}</EmptyProducts> : null}
              {selectedProduct ? (
                <>
                  <ProductHeader
                    name={selectedProduct.name}
                    environment={selectedProduct.environment}
                  />
                  {errorAt === 'workspace' && error ? (
                    <div className="border-b border-line px-5 py-4 sm:px-6">
                      {errorFor('workspace')}
                    </div>
                  ) : null}
                  {visibleSecrets.length > 0 ? (
                    <ul aria-label={`Keys in ${selectedProduct.name}`}>
                      {visibleSecrets.map((s) => (
                        <KeyRow
                          key={s.id}
                          name={s.key_name}
                          version={s.version}
                          revealed={revealedId === s.id ? revealed : null}
                          remaining={remaining}
                          onReveal={() => {
                            hideReveal();
                            setRevealedId(s.id);
                            act('workspace', () => reveal(s));
                          }}
                          onCopy={() => act('workspace', copyRevealed)}
                          onHide={hideReveal}
                        />
                      ))}
                    </ul>
                  ) : (
                    <NoKeys product={selectedProduct.name} />
                  )}
                </>
              ) : null}
              <div className="flex-1" />
              <ClipboardNotice clip={clip} onClear={clearClipboard} variant="band" />
              {selectedProduct ? (
                <SecretForm
                  ids={ids}
                  name={secretName}
                  value={secretValue}
                  onName={setSecretName}
                  onValue={setSecretValue}
                  onSubmit={(e) => act('secret', () => addSecret(e), e)}
                  busy={busySlots.has('secret')}
                  error={errorFor('secret')}
                  errorId={errorId('secret')}
                  onEdit={() => dismiss('secret')}
                />
              ) : null}
            </div>
          </div>
          <div className="card-band flex items-center justify-between gap-3 px-5 py-2.5 font-mono text-[11px] text-muted sm:px-6">
            <span>Decrypted in this browser</span>
            <span className="hidden text-right sm:inline">Locks after {IDLE_MINUTES} min idle</span>
          </div>
        </Card>

        <PasswordPanel
          ids={ids}
          newPassword={newPassword}
          confirmPassword={confirmPassword}
          strength={pwStrength}
          pendingAuth={pendingAuth}
          message={pwMsg}
          error={errorFor('password')}
          errorId={errorId('password')}
          onEdit={() => dismiss('password')}
          onNewPassword={setNewPassword}
          onConfirmPassword={setConfirmPassword}
          onSubmit={(e) => act('password', () => changePassword(e), e)}
          busy={busySlots.has('password')}
          onRetry={() => act('password', retryPasswordAuth)}
        />
      </main>
      <AppFooter />
    </div>
  );
}
