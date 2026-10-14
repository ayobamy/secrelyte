'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { MIN_PASSWORD_LENGTH } from '@/services/vault';
import { EyeOpen, EyeShut, PasswordField, StrengthMeter } from '@/components/password-field';
import {
  ArrowDot,
  FIELD_QUIET,
  FieldError,
  PRIMARY_BUTTON,
  SMALL_INK,
  SMALL_QUIET,
  StateDot,
} from '@/components/ui';
import { joinIds, useFieldErrors } from '@/components/use-field-errors';

/**
 * The vault's forms: add a product, add a key, change the password. Each owns only its inline
 * validation state (which field the browser refused, and why). vault-app.tsx owns every value
 * and handler, and passes in the handler's failure as `error`, with its id so the fields can
 * point at it through aria-describedby.
 */

type HandlerError = {
  /** The rendered failure from the submit handler, or null. */
  error: ReactNode;
  /** The id that failure carries, so the fields can reference it. */
  errorId: string;
  /** Called on any edit, so a handler failure never outlives the values it was about. */
  onEdit: () => void;
  /** This form's action is in flight: its submit is disabled until it settles. */
  busy?: boolean;
};

type ProductFormProps = HandlerError & {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  /** The empty vault's one action: the full-width ink CTA. Otherwise a quiet row in the rail. */
  prominent?: boolean;
};

export function ProductForm({
  id,
  value,
  onChange,
  onSubmit,
  prominent,
  error,
  errorId,
  onEdit,
  busy = false,
}: ProductFormProps) {
  const fields = useFieldErrors<'name'>();
  const messageId = `${id}-message`;
  return (
    <form onSubmit={onSubmit}>
      {prominent ? null : (
        <p className="mb-3 text-xs font-medium tracking-[0.16em] text-muted uppercase">
          Add a product
        </p>
      )}
      <label htmlFor={id} className="field-label">
        Product name
      </label>
      <div className={prominent ? 'mt-2 space-y-3' : 'mt-2 flex gap-2'}>
        <input
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            fields.clear('name');
            onEdit();
          }}
          onInvalid={(e) => {
            e.preventDefault();
            fields.report('name', e.currentTarget, 'Name the product, for example Stripe.');
          }}
          required
          placeholder="e.g. Stripe"
          autoComplete="off"
          aria-invalid={fields.errors.name ? true : undefined}
          aria-describedby={joinIds(fields.errors.name && messageId, Boolean(error) && errorId)}
          className={prominent ? 'field' : 'field field-compact min-w-0 flex-1'}
        />
        {prominent ? (
          <button
            type="submit"
            disabled={busy}
            aria-busy={busy || undefined}
            className={PRIMARY_BUTTON}
          >
            Add product
            <ArrowDot />
          </button>
        ) : (
          <button
            type="submit"
            disabled={busy}
            aria-busy={busy || undefined}
            className={FIELD_QUIET}
          >
            Add product
          </button>
        )}
      </div>
      {fields.errors.name ? <FieldError id={messageId}>{fields.errors.name}</FieldError> : null}
      {error ? <div className="mt-3">{error}</div> : null}
    </form>
  );
}

type SecretValueFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onInvalid: (input: HTMLInputElement) => void;
  invalid: boolean;
  describedBy?: string;
};

/**
 * Engines without -webkit-text-security would draw a masked text field in plain text, so there
 * the field falls back to type=password. Checked once, on the client: this field only renders in
 * the unlocked vault, which never comes from the server.
 */
function textMaskSupported(): boolean {
  return typeof CSS !== 'undefined' && CSS.supports('-webkit-text-security', 'disc');
}

/** The value being added, masked like every stored value until its own toggle shows it. */
function SecretValueField({
  id,
  value,
  onChange,
  onInvalid,
  invalid,
  describedBy,
}: SecretValueFieldProps) {
  const [visible, setVisible] = useState(false);
  const [cssMask] = useState(textMaskSupported);
  return (
    <div>
      <label htmlFor={id} className="field-label">
        Secret value
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          type={visible || cssMask ? 'text' : 'password'}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onInvalid={(e) => {
            e.preventDefault();
            onInvalid(e.currentTarget);
          }}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          placeholder="Paste the value"
          className={`field field-mono field-compact field-has-toggle ${visible ? '' : 'field-masked'}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide value' : 'Show value'}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute top-1/2 right-0.5 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-muted transition-colors duration-200 hover:bg-base hover:text-ink"
        >
          {visible ? <EyeShut /> : <EyeOpen />}
        </button>
      </div>
    </div>
  );
}

type SecretFormProps = HandlerError & {
  ids: string;
  name: string;
  value: string;
  onName: (name: string) => void;
  onValue: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
};

/** Adding a key, as the card's footer: a mono name, a masked value, and Store ciphertext. */
export function SecretForm({
  ids,
  name,
  value,
  onName,
  onValue,
  onSubmit,
  error,
  errorId,
  onEdit,
  busy = false,
}: SecretFormProps) {
  const fields = useFieldErrors<'name' | 'value'>();
  const nameId = `${ids}-secret-name`;
  const valueId = `${ids}-secret-value`;
  const noteId = `${ids}-seal-note`;
  const handlerId = error ? errorId : null;
  return (
    <form onSubmit={onSubmit} className="card-band px-5 pt-4 pb-5 sm:px-6">
      <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Add a key</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <label htmlFor={nameId} className="field-label">
            Secret name
          </label>
          <input
            id={nameId}
            value={name}
            onChange={(e) => {
              onName(e.target.value);
              fields.clear('name');
              onEdit();
            }}
            onInvalid={(e) => {
              e.preventDefault();
              fields.report(
                'name',
                e.currentTarget,
                'Name the key, for example STRIPE_SECRET_KEY.',
              );
            }}
            required
            placeholder="e.g. STRIPE_SECRET_KEY"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={fields.errors.name ? true : undefined}
            aria-describedby={joinIds(fields.errors.name && `${nameId}-message`, handlerId)}
            className="field field-mono field-compact mt-2"
          />
          {fields.errors.name ? (
            <FieldError id={`${nameId}-message`}>{fields.errors.name}</FieldError>
          ) : null}
        </div>
        <div>
          <SecretValueField
            id={valueId}
            value={value}
            onChange={(next) => {
              onValue(next);
              fields.clear('value');
              onEdit();
            }}
            onInvalid={(input) => fields.report('value', input, 'Paste the value to seal.')}
            invalid={Boolean(fields.errors.value)}
            describedBy={joinIds(fields.errors.value && `${valueId}-message`, handlerId, noteId)}
          />
          {fields.errors.value ? (
            <FieldError id={`${valueId}-message`}>{fields.errors.value}</FieldError>
          ) : null}
        </div>
      </div>
      {error ? <div className="mt-4">{error}</div> : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p id={noteId} className="text-xs leading-5 text-muted">
          Sealed in this tab with the product key. Only ciphertext is sent.
        </p>
        <button type="submit" disabled={busy} aria-busy={busy || undefined} className={SMALL_INK}>
          Store ciphertext
        </button>
      </div>
    </form>
  );
}

type PasswordPanelProps = HandlerError & {
  ids: string;
  newPassword: string;
  confirmPassword: string;
  strength: { score: number; ok: boolean; reason: string | null } | null;
  pendingAuth: boolean;
  message: string | null;
  onNewPassword: (value: string) => void;
  onConfirmPassword: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onRetry: () => void;
};

/** Change password, closed by default so the workspace leads. */
export function PasswordPanel({
  ids,
  newPassword,
  confirmPassword,
  strength,
  pendingAuth,
  message,
  error,
  errorId,
  onEdit,
  onNewPassword,
  onConfirmPassword,
  onSubmit,
  onRetry,
  busy = false,
}: PasswordPanelProps) {
  const fields = useFieldErrors<'new' | 'confirm'>();
  const meterId = `${ids}-pw-meter`;
  const confirmMessageId = `${ids}-pw-confirm-message`;
  const handlerId = error ? errorId : null;
  return (
    <details className="disclosure chip-card mt-6">
      <summary className="flex items-center justify-between gap-4 rounded-[1.25rem] px-5 py-4 sm:px-6">
        <span>
          <span className="block text-sm font-semibold text-ink">Change password</span>
          <span className="mt-0.5 block text-sm leading-6 text-muted">
            Wraps rotate first, then the login key. The recovery kit stays valid.
          </span>
        </span>
        <span
          aria-hidden
          className="disclosure-icon grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg leading-none text-ink ring-1 ring-line"
        >
          +
        </span>
      </summary>
      <form onSubmit={onSubmit} className="border-t border-line px-5 py-5 sm:px-6">
        <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <PasswordField
              label="New password"
              value={newPassword}
              onChange={(value) => {
                onNewPassword(value);
                fields.clear('new');
                onEdit();
              }}
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              describedBy={joinIds(meterId, handlerId)}
              invalid={Boolean(fields.errors.new)}
              onInvalid={(input) =>
                fields.report(
                  'new',
                  input,
                  input.validity.valueMissing
                    ? 'Enter a new password.'
                    : `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
                )
              }
            />
            <StrengthMeter
              id={meterId}
              strength={strength}
              length={newPassword.length}
              minLength={MIN_PASSWORD_LENGTH}
              error={fields.errors.new}
            />
          </div>
          <div>
            <PasswordField
              label="Confirm"
              value={confirmPassword}
              onChange={(value) => {
                onConfirmPassword(value);
                fields.clear('confirm');
                onEdit();
              }}
              autoComplete="new-password"
              revealNoun="confirmation"
              required
              describedBy={joinIds(fields.errors.confirm && confirmMessageId, handlerId)}
              invalid={Boolean(fields.errors.confirm)}
              onInvalid={(input) => fields.report('confirm', input, 'Type the new password again.')}
            />
            {fields.errors.confirm ? (
              <FieldError id={confirmMessageId}>{fields.errors.confirm}</FieldError>
            ) : null}
          </div>
        </div>
        {error ? <div className="mt-4 max-w-2xl">{error}</div> : null}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} aria-busy={busy || undefined} className={SMALL_INK}>
            {busy ? 'Deriving keys on this device' : 'Rotate wraps'}
          </button>
          {pendingAuth ? (
            <button type="button" onClick={onRetry} disabled={busy} className={SMALL_QUIET}>
              Retry login-key update
            </button>
          ) : null}
          <p role="status" className="flex items-center gap-2 text-sm text-sealed-ink">
            {message ? (
              <>
                <StateDot tone="sealed" />
                {message}
              </>
            ) : null}
          </p>
        </div>
      </form>
    </details>
  );
}
