'use client';

import { useEffect, useState } from 'react';
import { CountdownRing } from '@/components/countdown-ring';
import { DEMO_KEY_NAME, DEMO_SECRET } from '@/lib/brand/landing-content';
import { formatRevealSeconds, revealRatio, revealRemaining } from '@/lib/reveal-timer';

const MASK = '•'.repeat(22);

const OTHER_KEYS = [
  { name: 'STRIPE_WEBHOOK_SECRET', version: 'v1' },
  { name: 'STRIPE_RESTRICTED_KEY', version: 'v2' },
] as const;

/**
 * The hero's live product moment: one masked value, a keyboard-operable reveal that turns the
 * box exposed-red with a countdown ring, and an automatic re-mask at 30 seconds. Below it, the
 * same secret as the server holds it, which does not change when you reveal. That contrast is
 * the guarantee, shown rather than described.
 */
export function ProductPreview() {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [announcement, setAnnouncement] = useState('');

  const remaining = startedAt === null ? 0 : revealRemaining(startedAt, now);
  const revealed = startedAt !== null && remaining > 0;
  const state = revealed ? 'revealed' : 'masked';

  useEffect(() => {
    if (startedAt === null) {
      return;
    }
    const id = window.setInterval(() => {
      const t = Date.now();
      if (revealRemaining(startedAt, t) === 0) {
        setStartedAt(null);
        setAnnouncement('Masked again.');
        return;
      }
      setNow(t);
    }, 100);
    // Escape hides the value from anywhere on the page while it is on screen.
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setStartedAt(null);
        setAnnouncement('Hidden.');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('keydown', onKey);
    };
  }, [startedAt]);

  function toggle() {
    if (revealed) {
      setStartedAt(null);
      setAnnouncement('Hidden.');
      return;
    }
    const t = Date.now();
    setNow(t);
    setStartedAt(t);
    setAnnouncement('Revealed. It masks itself again in 30 seconds.');
  }

  return (
    <figure aria-labelledby="preview-caption" className="relative">
      <figcaption id="preview-caption" className="sr-only">
        A working preview of a Secrelyte vault. Reveal shows one sample value for 30 seconds.
      </figcaption>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <div className="bezel">
        <div className="bezel-inner">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-base font-mono text-[11px] font-semibold text-ink"
              >
                S
              </span>
              <p className="truncate text-sm font-semibold tracking-tight text-ink">Stripe</p>
              <span className="pill">production</span>
            </div>
            <p className="flex shrink-0 items-center gap-2 font-mono text-[11px] text-sealed-ink">
              <span aria-hidden className="sealed-dot" />
              encrypted
            </p>
          </div>

          <ul aria-label="Keys in Stripe">
            <li className="key-row px-4 pt-4 pb-4 sm:px-5" data-active="true">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[12.5px] font-medium text-ink">{DEMO_KEY_NAME}</p>
                <p className="font-mono text-[11px] text-muted">v3</p>
              </div>

              <div className="value-box mt-3 px-3.5 py-3" data-state={state}>
                <div className="flex h-7 items-center justify-between gap-3">
                  {revealed ? (
                    <p
                      className="unmask min-w-0 truncate font-mono text-[15px] text-ink"
                      translate="no"
                    >
                      {DEMO_SECRET}
                    </p>
                  ) : (
                    <p className="min-w-0 font-mono text-[15px] tracking-[0.16em]">
                      <span className="sr-only">Masked value</span>
                      <span aria-hidden className="seal-in inline-block max-w-full">
                        <span className="sealed-dots">{MASK}</span>
                      </span>
                    </p>
                  )}
                  <span
                    aria-hidden
                    className={revealed ? 'shrink-0 text-exposed-ink' : 'invisible shrink-0'}
                  >
                    <CountdownRing ratio={revealRatio(remaining)} label="" size={22} />
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="stack-swap min-w-0 text-xs leading-5 text-muted">
                  <span className={revealed ? 'invisible' : undefined}>
                    Masked by default. One value at a time.
                  </span>
                  <span className={revealed ? undefined : 'invisible'}>
                    Masks again in{' '}
                    <span className="font-mono text-exposed-ink tabular-nums">
                      {formatRevealSeconds(remaining)}
                    </span>
                    . Esc hides it now.
                  </span>
                </p>
                <button
                  type="button"
                  onClick={toggle}
                  className={
                    revealed
                      ? 'min-w-[8.5rem] shrink-0 rounded-full bg-paper px-4 py-2 text-sm text-ink ring-1 ring-line transition-[transform,background-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-base active:scale-[0.98]'
                      : 'ink-shine min-w-[8.5rem] shrink-0 rounded-full bg-ink px-4 py-2 text-sm text-paper transition-[transform,background-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-ink/90 active:scale-[0.98]'
                  }
                >
                  {revealed ? 'Hide now' : 'Reveal for 30s'}
                </button>
              </div>
            </li>
            {OTHER_KEYS.map((key) => (
              <li
                key={key.name}
                className="key-row flex items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5"
              >
                <p className="min-w-0 truncate font-mono text-[12.5px] text-muted">{key.name}</p>
                <p className="flex shrink-0 items-center gap-3">
                  <span className="sr-only">Masked</span>
                  <span aria-hidden className="sealed-dots font-mono text-[13px] tracking-[0.16em]">
                    ••••••••
                  </span>
                  <span className="font-mono text-[11px] text-muted">{key.version}</span>
                </p>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-3 border-t border-line bg-base px-4 py-2.5 font-mono text-[11px] text-muted sm:px-5">
            <span>Decrypted in this browser</span>
            <span className="text-right">Locks after 15 min idle</span>
          </div>
        </div>
      </div>

      <svg aria-hidden viewBox="0 0 24 44" className="ml-7 block h-11 w-6 sm:ml-9">
        <path className="drop-path" d="M12 0 V36" />
        <circle className="drop-node" cx="12" cy="39" r="3.5" />
        <circle className="drop-packet" cx="12" cy="2" r="2.5" />
      </svg>

      <div className="chip-card max-w-[23rem] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
            On our server
          </p>
          <p className="seal-badge flex items-center gap-1.5 font-mono text-[11px] text-sealed-ink">
            <span aria-hidden className="sealed-dot" />
            sealed
          </p>
        </div>
        <dl className="mt-3 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1.5 font-mono text-[11.5px]">
          <dt className="text-muted">name</dt>
          <dd className="truncate text-ink">{DEMO_KEY_NAME}</dd>
          <dt className="text-muted">ciphertext</dt>
          <dd className="truncate text-ink">
            <span className="seal-cipher inline-block max-w-full truncate align-bottom">
              7c2e91f40ad8b3e6a91c…
            </span>
          </dd>
          <dt className="text-muted">bound to</dt>
          <dd className="truncate text-ink">product, secret id, v3</dd>
          <dt className="text-muted">vault key</dt>
          <dd className="text-ink">wrapped</dd>
        </dl>
        <p
          className="server-note stack-swap mt-3 border-t border-line pt-3 text-xs leading-5 text-muted"
          data-state={state}
        >
          <span className={revealed ? 'invisible' : undefined}>
            The same secret, as we store it. The name is readable. The value is not.
          </span>
          <span className={revealed ? undefined : 'invisible'}>
            Unchanged. The reveal happened in your browser.
          </span>
        </p>
      </div>
    </figure>
  );
}
