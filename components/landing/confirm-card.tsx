'use client';

import { useEffect, useRef, useState } from 'react';
import { StatusTag } from '@/components/landing/status-tag';
import { CLAUDE } from '@/lib/brand/landing-content';

type Outcome = 'pending' | 'cancelled' | 'sent';

const RESULT: Record<Exclude<Outcome, 'pending'>, string> = {
  cancelled: 'Cancelled. Nothing was sent.',
  sent: 'Preview only. The Claude interface is Next, so nothing was sent.',
};

/**
 * The safety interlock, as a demo: the model proposes, the card states every parameter in
 * full, and only a click acts. Both buttons work so the demo is operable by keyboard, and
 * neither one sends anything, because this capability is Next.
 */
export function ConfirmCard() {
  const [outcome, setOutcome] = useState<Outcome>('pending');
  const resetRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    if (!moved.current) {
      return;
    }
    if (outcome === 'pending') {
      cancelRef.current?.focus();
    } else {
      resetRef.current?.focus();
    }
  }, [outcome]);

  function choose(next: Outcome) {
    moved.current = true;
    setOutcome(next);
  }

  const rows = [
    ['From', 'Stripe · production'],
    ['Keys', CLAUDE.keys.join('\n')],
    ['To', CLAUDE.recipient],
    ['Expires', '24 hours'],
    ['View limit', '3 views'],
  ] as const;

  return (
    <div className="chip-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
          Proposed action
        </p>
        <p className="flex items-center gap-3">
          <span className="hidden font-mono text-[11px] text-muted sm:inline">
            needs your click
          </span>
          <StatusTag status="next" />
        </p>
      </div>
      <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-ink">Share 2 keys</p>
      <dl className="mt-3 divide-y divide-line rounded-2xl border border-line">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[5.5rem_1fr] gap-3 px-3.5 py-2.5 text-sm sm:grid-cols-[6.5rem_1fr]"
          >
            <dt className="text-muted">{label}</dt>
            <dd className="min-w-0 font-mono text-[12.5px] break-words whitespace-pre-line text-ink">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="sr-only" aria-live="polite">
        {outcome === 'pending' ? '' : RESULT[outcome]}
      </p>

      {outcome === 'pending' ? (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => choose('cancelled')}
            className="rounded-full bg-paper px-4 py-2 text-sm text-ink ring-1 ring-line transition-colors duration-300 hover:bg-base"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => choose('sent')}
            className="rounded-full bg-ink px-4 py-2 text-sm text-paper transition-colors duration-300 hover:bg-ink/90"
          >
            Send link
          </button>
        </div>
      ) : (
        <div className="confirm-status mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-base px-3.5 py-3">
          <p className="text-sm text-ink" aria-hidden>
            {RESULT[outcome]}
          </p>
          <button
            ref={resetRef}
            type="button"
            onClick={() => choose('pending')}
            className="text-sm font-medium text-ink underline decoration-line decoration-2 underline-offset-4 hover:decoration-signal"
          >
            Show the card again
          </button>
        </div>
      )}
    </div>
  );
}
