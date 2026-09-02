'use client';

import { useEffect, useState } from 'react';
import { CountdownRing } from '@/components/countdown-ring';
import { formatRevealSeconds, revealRatio, revealRemaining } from '@/lib/reveal-timer';

const MASK = '••••••••••••••••';
const SAMPLE = 'sk_live_••••k4m2';

export function ProductPreview() {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  const remaining = startedAt === null ? 0 : revealRemaining(startedAt, now);
  const revealed = startedAt !== null && remaining > 0;

  useEffect(() => {
    if (startedAt === null) {
      return;
    }
    const id = window.setInterval(() => {
      const t = Date.now();
      if (revealRemaining(startedAt, t) === 0) {
        setStartedAt(null);
        return;
      }
      setNow(t);
    }, 100);
    return () => window.clearInterval(id);
  }, [startedAt]);

  function reveal() {
    const t = Date.now();
    setNow(t);
    setStartedAt(t);
  }

  function hide() {
    setStartedAt(null);
  }

  return (
    <div className="preview-stage">
      <div className="preview-halo" aria-hidden />
      <div className="preview-ring" aria-hidden />
      <div className="preview-card relative rounded-[2rem] border border-line/70 bg-line/25 p-1.5 shadow-[0_18px_50px_rgba(14,17,22,0.05)]">
        <div className="light-sweep" />
        <div className="relative z-10 overflow-hidden rounded-[calc(2rem-0.375rem)] border border-line bg-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Vault</p>
            <p className="encrypted-pulse font-mono text-[11px] text-sealed-ink">encrypted</p>
          </div>
          <div className="space-y-4 px-5 py-5">
            <p className="max-w-[16rem] rounded-2xl bg-base px-4 py-3 text-[15px] leading-6 text-ink">
              the stripe live key for production
            </p>
            <div
              className={
                revealed
                  ? 'rounded-2xl border-2 border-exposed bg-exposed/5 px-4 py-4'
                  : 'sealed-wait rounded-2xl border border-line px-4 py-4'
              }
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted">Stripe · production</p>
                  {revealed ? (
                    <p className="unmask mt-2 font-mono text-base text-ink">{SAMPLE}</p>
                  ) : (
                    <p className="mt-2 font-mono text-base tracking-[0.22em] text-sealed-ink">
                      {MASK.split('').map((ch, i) => (
                        <span
                          key={i}
                          className="mask-dot"
                          style={{ animationDelay: `${i * 70}ms` }}
                        >
                          {ch}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
                {revealed ? (
                  <span className="text-exposed-ink">
                    <CountdownRing
                      ratio={revealRatio(remaining)}
                      label={`${formatRevealSeconds(remaining)} until remask`}
                    />
                  </span>
                ) : null}
              </div>
              {revealed ? (
                <p className="mt-2 text-xs text-exposed-ink" aria-live="polite">
                  Revealed · {formatRevealSeconds(remaining)}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs leading-5 text-muted">
                  {revealed
                    ? 'Plaintext is temporary. It remasks. The clipboard clears after it.'
                    : 'Masked until you ask. One value at a time.'}
                </p>
                <button
                  type="button"
                  onClick={revealed ? hide : reveal}
                  className={
                    revealed
                      ? 'rounded-full px-4 py-2 text-sm text-ink ring-1 ring-line transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-base active:scale-[0.98]'
                      : 'ink-shine inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm text-paper transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-ink/90 active:scale-[0.98]'
                  }
                >
                  {revealed ? 'Hide now' : 'Reveal for 30s'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
