'use client';

import Link from 'next/link';
import { HeroStage } from '@/components/hero-stage';

const MASK = '••••••••••••••••';

export function LockedVault() {
  return (
    <HeroStage>
      <div className="lg:col-span-5">
        <p className="text-xs font-medium tracking-[0.22em] text-muted uppercase">This device</p>
        <h1 className="settle mt-5 text-[2.6rem] leading-[0.95] font-semibold tracking-[-0.04em] text-ink sm:text-5xl">
          Vault
        </h1>
        <p className="settle settle-delay-1 mt-6 max-w-md text-[17px] leading-7 text-muted">
          Locked. Keys live in memory on this device only. Unlock to unwrap. Nothing is stored in
          the tab.
        </p>
        <div className="settle settle-delay-3 mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/login"
            className="ink-shine cta-shine group inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-paper no-underline transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-ink/90 active:scale-[0.98]"
          >
            Unlock
            <span
              aria-hidden
              className="nudge grid h-7 w-7 place-items-center rounded-full bg-signal text-sm font-semibold text-ink transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:scale-105"
            >
              →
            </span>
          </Link>
          <Link
            href="/signup"
            className="rounded-full px-5 py-3 text-ink no-underline ring-1 ring-line transition-colors hover:bg-paper"
          >
            Create a vault
          </Link>
        </div>
      </div>
      <div className="settle settle-delay-1 lg:col-span-7">
        <div className="preview-stage">
          <div className="preview-halo" aria-hidden />
          <div className="preview-ring" aria-hidden />
          <div className="preview-card relative rounded-[2rem] border border-line/70 bg-line/25 p-1.5 shadow-[0_18px_50px_rgba(14,17,22,0.05)]">
            <div className="light-sweep" />
            <div className="relative z-10 overflow-hidden rounded-[calc(2rem-0.375rem)] border border-line bg-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Sealed</p>
                <p className="encrypted-pulse font-mono text-[11px] text-sealed-ink">encrypted</p>
              </div>
              <div className="space-y-4 px-5 py-5">
                <p className="max-w-[18rem] rounded-2xl bg-base px-4 py-3 text-[15px] leading-6 text-ink">
                  Ciphertext is on the server. The unwrap key is not.
                </p>
                <div className="sealed-wait rounded-2xl border border-line px-4 py-4">
                  <p className="text-xs text-muted">This device · locked</p>
                  <p className="mt-2 font-mono text-base tracking-[0.22em] text-sealed-ink">
                    {MASK.split('').map((ch, i) => (
                      <span key={i} className="mask-dot" style={{ animationDelay: `${i * 70}ms` }}>
                        {ch}
                      </span>
                    ))}
                  </p>
                  <p className="mt-4 text-xs leading-5 text-muted">
                    Masked until you unlock. One password. Keys stay in this tab.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </HeroStage>
  );
}
