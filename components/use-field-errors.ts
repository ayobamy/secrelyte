'use client';

import { useRef, useState } from 'react';

type Validatable = HTMLInputElement | HTMLTextAreaElement;

/**
 * Inline field errors for every form in the app. Native constraint validation stays the gate
 * (required, type=email, minLength), so a submit handler never sees a form the browser would
 * refuse. Only the browser's bubble is replaced: each refusal renders under its field in the
 * page's own words, and the first refused field of an attempt takes focus.
 *
 * Wire a field with `onInvalid={(e) => { e.preventDefault(); report(name, e.currentTarget, msg) }}`
 * and call `clear(name)` from its onChange.
 */
export function useFieldErrors<Field extends string>() {
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const focusedThisAttempt = useRef(false);

  function report(field: Field, input: Validatable, message: string) {
    setErrors((current) => ({ ...current, [field]: message }));
    if (focusedThisAttempt.current) return;
    focusedThisAttempt.current = true;
    input.focus();
    // Every invalid event of one submit attempt fires in the same task.
    window.setTimeout(() => {
      focusedThisAttempt.current = false;
    }, 0);
  }

  function clear(field: Field) {
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }

  return { errors, report, clear };
}

/** Joins aria-describedby ids, skipping the ones that are not on screen. */
export function joinIds(...ids: Array<string | false | null | undefined>): string | undefined {
  const joined = ids.filter(Boolean).join(' ');
  return joined || undefined;
}
