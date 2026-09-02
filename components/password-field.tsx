'use client';

import { useId, useState } from 'react';

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  required?: boolean;
  minLength?: number;
  inputClassName?: string;
  revealNoun?: string;
};

function EyeOpen() {
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

function EyeShut() {
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
  inputClassName = 'rounded-2xl border border-line bg-base px-4 py-3 pr-12',
  revealNoun = 'password',
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const showLabel = `Show ${revealNoun}`;
  const hideLabel = `Hide ${revealNoun}`;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full ${inputClassName}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute top-1/2 right-1.5 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-ink hover:bg-line/60"
        >
          {visible ? <EyeShut /> : <EyeOpen />}
        </button>
      </div>
    </div>
  );
}
