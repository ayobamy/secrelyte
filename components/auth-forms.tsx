'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { toB64url } from '@/services/crypto';
import {
  MIN_PASSWORD_LENGTH,
  assembleSignupMaterial,
  beginUnlock,
  scorePassword,
  unlockKeys,
  type SignupMaterial,
} from '@/services/vault';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { usePrefetchFull } from '@/lib/prefetch';
import { Card, CardBody, CardFactBand, CardLinkBand } from '@/components/auth-shell';
import { PasswordField, StrengthMeter } from '@/components/password-field';
import { ArrowDot, BusyDot, FieldError, PRIMARY_BUTTON, TEXT_LINK } from '@/components/ui';
import { joinIds, useFieldErrors } from '@/components/use-field-errors';
import { isRetryableAuthError, signupUserMessage, unlockUserMessage } from '@/lib/signup-errors';

type Kit = SignupMaterial['kit'] & {
  email: string;
  /** Signup skipped the sign-in because the address must be confirmed first. */
  confirmEmail: boolean;
};

let pendingKit: Kit | null = null;
let pendingKeys: { vk: SignupMaterial['vk']; sk: SignupMaterial['sk'] } | null = null;

/** The waits before each retry of the sign-in that follows signup. */
const SIGN_IN_RETRY_DELAYS_MS = [500, 1500];

/**
 * Signs in the account signup just created, retrying failures that clear by themselves (an
 * auth gateway timeout, a 429). A sign-in that still fails leaves no session, which the kit
 * screen checks for before it records the kit.
 */
async function signInAfterSignup(email: string, authPassword: string): Promise<void> {
  const supabase = createBrowserSupabase();
  for (const delay of [...SIGN_IN_RETRY_DELAYS_MS, null]) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: authPassword });
    if (!error || delay === null || !isRetryableAuthError(error)) return;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

/** What the button says while Argon2id runs, on signup and on unlock alike. */
const DERIVING = 'Deriving keys on this device';

type FieldName = 'email' | 'password';

function emailProblem(input: HTMLInputElement): string {
  return input.validity.valueMissing
    ? 'Enter the email for this vault.'
    : 'Enter an email address, like name@example.com.';
}

function passwordProblem(input: HTMLInputElement): string {
  return input.validity.valueMissing
    ? 'Enter your password.'
    : `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
}

type EmailFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  invalid: boolean;
  describedBy?: string;
  onInvalid: (input: HTMLInputElement) => void;
};

/*
 * No name attributes on any credential field, on purpose: a submit that lands before hydration
 * runs the browser's default GET, and a named field would put the email or password in the URL.
 * Unnamed fields send nothing. Password managers key on the autocomplete attributes instead.
 */
function EmailField({
  id,
  value,
  onChange,
  error,
  invalid,
  describedBy,
  onInvalid,
}: EmailFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        Email
      </label>
      <input
        id={id}
        type="email"
        required
        autoComplete="username"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onInvalid={(e) => {
          e.preventDefault();
          onInvalid(e.currentTarget);
        }}
        aria-invalid={invalid || undefined}
        aria-describedby={joinIds(error && errorId, describedBy)}
        className="field mt-2"
      />
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

/** The submit button: one primary action, and while Argon2id runs it says so and stays shut. */
function SubmitButton({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button type="submit" disabled={busy} aria-busy={busy || undefined} className={PRIMARY_BUTTON}>
      {busy ? DERIVING : label}
      {busy ? <BusyDot /> : <ArrowDot />}
    </button>
  );
}

/** A form-level failure, announced, with a short title and the specific reason under it. */
function FormAlert({ id, title, children }: { id: string; title: string; children: string }) {
  return (
    <div id={id} role="alert" className="notice rise px-4 py-3" data-tone="error">
      <p className="flex items-center gap-2 text-sm font-medium text-exposed-ink">
        <span aria-hidden className="state-dot" data-tone="error" />
        {title}
      </p>
      <p className="mt-1 pl-3.5 text-sm leading-6 text-ink">{children}</p>
    </div>
  );
}

export function SignupForm() {
  const router = useRouter();
  usePrefetchFull('/vault');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const strength = password ? scorePassword(password) : null;
  const fields = useFieldErrors<FieldName>();
  const id = useId();

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
      pendingKit = {
        ...material.kit,
        email: material.email,
        confirmEmail: json.confirmRequired === true,
      };
      pendingKeys = { vk: material.vk, sk: material.sk };
      if (!json.confirmRequired) {
        // The account exists from here on, so a sign-in that still fails goes on to the kit
        // anyway: the kit lives only in this tab, and losing it would strand the account. The
        // kit screen finds no session and sends the user to Unlock to finish.
        await signInAfterSignup(material.email, material.authPassword);
        unlockKeys(material.vk, material.sk);
      }
      router.push('/vault');
    } catch {
      setError('Signup failed.');
    } finally {
      setBusy(false);
    }
  }

  // The handler's messages, routed to the field they are about. Any edit clears them (see the
  // fields' onChange), so a message never outlives the value it was about.
  const weakPassword = error !== null && strength !== null && error === strength.reason;
  const emailTaken = error !== null && error === signupUserMessage('EMAIL_TAKEN');
  const passwordError = fields.errors.password ?? (weakPassword ? error : null);
  const emailError = fields.errors.email ?? (emailTaken ? error : undefined);
  const formError = error !== null && !weakPassword && !emailTaken ? error : null;
  const meterId = `${id}-meter`;
  const alertId = `${id}-alert`;

  return (
    <Card>
      <form onSubmit={onSubmit} aria-describedby={formError ? alertId : undefined}>
        <CardBody className="space-y-5">
          <EmailField
            id={`${id}-email`}
            value={email}
            onChange={(value) => {
              setEmail(value);
              fields.clear('email');
              setError(null);
            }}
            error={emailError}
            invalid={Boolean(emailError)}
            onInvalid={(input) => fields.report('email', input, emailProblem(input))}
          />
          {emailTaken ? (
            <p className="-mt-3 text-sm text-muted">
              <Link prefetch href="/login" className={TEXT_LINK}>
                Unlock that vault
              </Link>
            </p>
          ) : null}
          <div>
            <PasswordField
              label="Password"
              value={password}
              onChange={(value) => {
                setPassword(value);
                fields.clear('password');
                setError(null);
              }}
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              describedBy={meterId}
              invalid={Boolean(passwordError)}
              onInvalid={(input) => fields.report('password', input, passwordProblem(input))}
            />
            <StrengthMeter
              id={meterId}
              strength={strength}
              length={password.length}
              minLength={MIN_PASSWORD_LENGTH}
              error={passwordError}
            />
          </div>
          {formError ? (
            <FormAlert id={alertId} title="The vault was not created.">
              {formError}
            </FormAlert>
          ) : null}
          <div className="pt-1">
            <SubmitButton busy={busy} label="Create vault" />
            <p role="status" className="sr-only">
              {busy ? 'Argon2id runs in this tab. It takes a moment.' : null}
            </p>
          </div>
        </CardBody>
      </form>
      <CardLinkBand>
        Already have a vault?{' '}
        <Link prefetch href="/login" className={TEXT_LINK}>
          Unlock
        </Link>
      </CardLinkBand>
      <CardFactBand aside="Argon2id · 64 MiB">Keys derive in this tab</CardFactBand>
    </Card>
  );
}

type KdfLookup = { m?: number; t?: number; p?: number; v?: 1 };

function fetchKdfParams(email: string): Promise<KdfLookup> {
  return fetch('/api/kdf-params', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  }).then((res) => res.json() as Promise<KdfLookup>);
}

/** Wait after the last keystroke in the email field before looking up its KDF parameters. */
const KDF_LOOKUP_DEBOUNCE_MS = 400;
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm() {
  const router = useRouter();
  usePrefetchFull('/vault');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fields = useFieldErrors<FieldName>();
  const id = useId();
  // The KDF lookup is a server round trip; started while the password is being typed, it is
  // usually done by the time Unlock is pressed. Keyed by email, so a changed email refetches.
  const kdfLookup = useRef<{ email: string; params: Promise<KdfLookup> } | null>(null);

  function kdfParamsFor(address: string): Promise<KdfLookup> {
    if (kdfLookup.current?.email !== address) {
      const params = fetchKdfParams(address);
      // A failed early lookup is retried at submit rather than surfacing as an error here.
      params.catch(() => {
        if (kdfLookup.current?.params === params) kdfLookup.current = null;
      });
      kdfLookup.current = { email: address, params };
    }
    return kdfLookup.current.params;
  }

  useEffect(() => {
    if (!LOOKS_LIKE_EMAIL.test(email)) return;
    const timer = window.setTimeout(() => void kdfParamsFor(email), KDF_LOOKUP_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const kdf = await kdfParamsFor(email);
      // One Argon2id derivation gives both the login key and the key that opens the vault.
      const pending = await beginUnlock(email, password, kdf);
      try {
        const supabase = createBrowserSupabase();
        const signed = await supabase.auth.signInWithPassword({
          email,
          password: pending.authPassword,
        });
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
        await pending.open(row);
      } finally {
        await pending.discard();
      }
      router.push('/vault');
    } catch {
      setError('Could not open the vault on this device. Check the password and try again.');
    } finally {
      setBusy(false);
    }
  }

  const alertId = `${id}-alert`;
  const failed = error !== null;

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <CardBody className="space-y-5">
          <EmailField
            id={`${id}-email`}
            value={email}
            onChange={(value) => {
              setEmail(value);
              fields.clear('email');
              setError(null);
            }}
            error={fields.errors.email}
            invalid={Boolean(fields.errors.email) || failed}
            describedBy={failed ? alertId : undefined}
            onInvalid={(input) => fields.report('email', input, emailProblem(input))}
          />
          <div>
            <PasswordField
              label="Password"
              value={password}
              onChange={(value) => {
                setPassword(value);
                fields.clear('password');
                setError(null);
              }}
              autoComplete="current-password"
              required
              describedBy={joinIds(
                fields.errors.password && `${id}-password-error`,
                failed && alertId,
              )}
              invalid={Boolean(fields.errors.password) || failed}
              onInvalid={(input) => fields.report('password', input, passwordProblem(input))}
            />
            {fields.errors.password ? (
              <FieldError id={`${id}-password-error`}>{fields.errors.password}</FieldError>
            ) : null}
          </div>
          {error ? (
            <FormAlert id={alertId} title="The vault did not open.">
              {error}
            </FormAlert>
          ) : null}
          <div className="pt-1">
            <SubmitButton busy={busy} label="Unlock" />
            <p role="status" className="sr-only">
              {busy ? 'Argon2id runs in this tab. It takes a moment.' : null}
            </p>
          </div>
        </CardBody>
      </form>
      <CardLinkBand>
        New here?{' '}
        <Link prefetch href="/signup" className={TEXT_LINK}>
          Create a vault
        </Link>
      </CardLinkBand>
      <CardFactBand aside="Argon2id">Your password never leaves this tab</CardFactBand>
    </Card>
  );
}

/**
 * The kit signup just made. It stays until the vault says it is saved (clearPendingKit), not
 * until first read: Back, or a link away and back again, returns to the same kit instead of an
 * account whose 24 words were never shown.
 */
export function peekPendingKit(): Kit | null {
  return pendingKit;
}

export function clearPendingKit(): void {
  pendingKit = null;
}

export function takePendingKeys() {
  const keys = pendingKeys;
  pendingKeys = null;
  return keys;
}
