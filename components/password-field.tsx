'use client';

import { useId, useState } from 'react';

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  required?: boolean;
  minLength?: number;
  revealNoun?: string;
  /** Ids of the hint, meter or error that explain this field. */
  describedBy?: string;
  invalid?: boolean;
  /**
   * Called instead of the browser's bubble when native validation rejects the field, so the
   * message can render inline, under the field, in the page's own words.
   */
  onInvalid?: (input: HTMLInputElement) => void;
};

export function EyeOpen() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function EyeShut() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M9.9 9.9A2.6 2.6 0 0 0 12 14.6a2.6 2.6 0 0 0 2.1-.9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M6.1 6.5C3.8 8.2 2.5 12 2.5 12s3.5 7 9.5 7c2.2 0 4.1-.6 5.7-1.5M17.6 15.2C19.8 13.6 21.5 12 21.5 12s-3.5-7-9.5-7c-.7 0-1.4.1-2 .2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  revealNoun = 'password',
  describedBy,
  invalid,
  onInvalid,
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const showLabel = `Show ${revealNoun}`;
  const hideLabel = `Hide ${revealNoun}`;

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onInvalid={(e) => {
            if (!onInvalid) return;
            e.preventDefault();
            onInvalid(e.currentTarget);
          }}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="field field-has-toggle"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute top-1/2 right-1 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-muted transition-colors duration-200 hover:bg-base hover:text-ink"
        >
          {visible ? <EyeShut /> : <EyeOpen />}
        </button>
      </div>
    </div>
  );
}

type Strength = { score: number; ok: boolean; reason: string | null } | null;

const STRENGTH_WORDS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'] as const;

/**
 * Four bars and a sentence for a password scorePassword has rated. Amber while it would be
 * refused, sealed green once it passes. The sentence is the field's description, so a screen
 * reader hears it on focus rather than on every keystroke. An error takes the sentence's place
 * and is announced, so the field never carries two competing messages.
 */
export function StrengthMeter({
  id,
  strength,
  length,
  minLength,
  error,
}: {
  id: string;
  strength: Strength;
  length: number;
  minLength: number;
  error?: string | null;
}) {
  const tone = strength === null ? 'idle' : strength.ok ? 'ok' : 'weak';
  const filled = strength === null ? 0 : Math.max(1, strength.score);
  const word =
    strength === null
      ? ''
      : length < minLength
        ? 'Too short'
        : (STRENGTH_WORDS[strength.score] ?? STRENGTH_WORDS[0]);
  return (
    <div className="mt-2.5">
      <div aria-hidden className="strength" data-tone={tone}>
        {[0, 1, 2, 3].map((bar) => (
          <span key={bar} data-on={bar < filled} />
        ))}
      </div>
      {error ? (
        <p id={id} role="alert" className="field-message mt-2" data-tone="error">
          {error}
        </p>
      ) : (
        <p id={id} className="mt-2 text-[13px] leading-5 text-muted">
          {strength === null ? (
            <>At least {minLength} characters. Three unrelated words work well.</>
          ) : (
            <>
              <span
                className={strength.ok ? 'font-medium text-sealed-ink' : 'font-medium text-ink'}
              >
                {word}.
              </span>{' '}
              {strength.reason ?? `Score ${strength.score} of 4.`}
            </>
          )}
        </p>
      )}
    </div>
  );
}
