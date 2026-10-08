'use client';

import { useState } from 'react';

type PreviewButtonProps = {
  label: string;
  /** What the button says when pressed, because the capability behind it is Next. */
  response: string;
  hint: string;
  tone?: 'ink' | 'exposed';
};

/**
 * A control in a Next-feature preview. It is a real button, so it is operable by keyboard,
 * and pressing it says plainly that nothing happened, the same way the Claude card does.
 */
export function PreviewButton({ label, response, hint, tone = 'ink' }: PreviewButtonProps) {
  const [pressed, setPressed] = useState(false);
  const toneClass =
    tone === 'exposed'
      ? 'bg-paper text-exposed-ink ring-1 ring-exposed/60 hover:bg-exposed/5'
      : 'bg-ink text-paper hover:bg-ink/90';
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="stack-swap min-w-0 flex-1 text-xs leading-5 text-muted">
        <span className={pressed ? 'invisible' : undefined}>{hint}</span>
        <span aria-hidden className={pressed ? 'text-ink' : 'invisible'}>
          {response}
        </span>
      </p>
      <p className="sr-only" aria-live="polite">
        {pressed ? response : ''}
      </p>
      <button
        type="button"
        onClick={() => setPressed(true)}
        className={`h-8 shrink-0 rounded-full px-3.5 text-[13px] transition-colors duration-300 ${toneClass}`}
      >
        {label}
      </button>
    </div>
  );
}
