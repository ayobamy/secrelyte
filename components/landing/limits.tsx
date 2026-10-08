import type { ReactNode } from 'react';
import { LIMITS, RECOVERY_CHALLENGE } from '@/lib/brand/landing-content';
import { StatusTag } from '@/components/landing/status-tag';

function RecoveryChallenge() {
  return (
    <div className="chip-card mt-5 max-w-md p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">Recovery kit</p>
        <p className="font-mono text-[11px] text-muted">{RECOVERY_CHALLENGE.words} words · PDF</p>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted">
        Type these three words back. The vault opens after.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {RECOVERY_CHALLENGE.asks.map((ask) => (
          <div key={ask.index}>
            <p className="font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">
              Word {ask.index}
            </p>
            <p
              className={
                ask.value
                  ? 'mt-1 rounded-xl border border-line bg-base px-2.5 py-2 font-mono text-[13px] text-ink'
                  : 'mt-1 flex items-center rounded-xl border border-ink/70 bg-paper px-2.5 py-2 font-mono text-[13px] text-muted'
              }
            >
              {ask.value || (
                <>
                  <span aria-hidden className="h-4 w-px bg-ink" />
                  <span className="sr-only">empty</span>
                </>
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function IdleLock() {
  return (
    <div className="chip-card mt-5 flex max-w-md items-center justify-between gap-4 p-4">
      <div>
        <p className="text-sm font-semibold text-ink">Idle for 15:00</p>
        <p className="mt-0.5 text-xs leading-5 text-muted">Vault locked. Keys wiped from memory.</p>
      </div>
      <span className="pill shrink-0">locked</span>
    </div>
  );
}

const INSETS: Record<string, () => ReactNode> = {
  '01': RecoveryChallenge,
  '02': IdleLock,
};

export function Limits() {
  return (
    <section id="limits" aria-labelledby="limits-title" className="px-3 pt-28 sm:px-5 lg:pt-36">
      <div className="mx-auto grid grid-cols-1 max-w-[80rem] gap-12 lg:grid-cols-12 lg:gap-10">
        <div data-reveal className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">
              {LIMITS.eyebrow}
            </p>
            <h2
              id="limits-title"
              className="mt-5 text-[2.25rem] leading-[1.04] font-semibold tracking-[-0.04em] text-ink sm:text-5xl lg:text-[3.5rem]"
            >
              {LIMITS.title}
            </h2>
            <p className="mt-6 max-w-sm text-lg leading-8 text-muted">{LIMITS.lead}</p>
          </div>
        </div>
        <ol className="border-t border-line lg:col-span-8" data-reveal-group>
          {LIMITS.items.map((item) => {
            const Inset = INSETS[item.n];
            return (
              <li
                key={item.n}
                data-reveal
                className="grid grid-cols-1 gap-3 border-b border-line py-8 sm:grid-cols-[4rem_1fr] sm:gap-6"
              >
                <p className="font-mono text-sm text-muted">{item.n}.</p>
                <div>
                  <h3 className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xl leading-snug font-semibold tracking-[-0.02em] text-ink sm:text-[1.375rem]">
                    {item.title}
                    {item.status ? <StatusTag status={item.status} /> : null}
                  </h3>
                  <p className="mt-2 max-w-2xl text-[15px] leading-7 text-muted">{item.body}</p>
                  {Inset ? <Inset /> : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
