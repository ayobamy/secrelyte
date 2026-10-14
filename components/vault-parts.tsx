'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { CLIPBOARD_CLEAR_MS, type ClipboardState } from '@/services/vault';
import { CountdownRing } from '@/components/countdown-ring';
import { StatusTag } from '@/components/landing/status-tag';
import { SMALL_INK, SMALL_QUIET } from '@/components/ui';
import { formatRevealSeconds, revealRatio } from '@/lib/reveal-timer';

/**
 * The vault's presentational pieces. No data, no crypto: vault-app.tsx owns every handler and
 * passes in only what each piece shows and the callbacks it fires.
 */

type StepState = 'todo' | 'current' | 'done';

function CheckGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6.2 5 8.6l4.5-5.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * One numbered step of the recovery kit, ticked once it is done. The badge sits in the title row
 * and the body runs full width under it on a phone, so three word fields fit side by side.
 */
export function KitStep({
  n,
  state,
  title,
  body,
  children,
}: {
  n: number;
  state: StepState;
  title: string;
  body: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="step px-5 py-5 sm:px-7" data-state={state}>
      <div className="flex items-center gap-3">
        <span className="step-badge">
          {state === 'done' ? <CheckGlyph /> : <span aria-hidden>{n}</span>}
          <span className="sr-only">
            Step {n}
            {state === 'done' ? ', done' : ''}
          </span>
        </span>
        <h2 className="text-[15px] leading-6 font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      </div>
      <div className="mt-2 sm:pl-10">
        <p className="text-sm leading-6 text-muted">{body}</p>
        <div className="mt-4">{children}</div>
      </div>
    </li>
  );
}

/** The product's letter tile, as on the hero card. */
export function ProductTile({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-6 w-6 rounded-md text-[10.5px]' : 'h-7 w-7 rounded-lg text-[11px]';
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center border border-line bg-paper font-mono font-semibold text-ink uppercase ${box}`}
    >
      {name.trim().charAt(0) || '·'}
    </span>
  );
}

const ROW_MASK = '••••••••••';

type KeyRowProps = {
  name: string;
  version: number;
  /** The plaintext while this row is revealed, otherwise null. It is in the DOM only then. */
  revealed: string | null;
  remaining: number;
  onReveal: () => void;
  onCopy: () => void;
  onHide: () => void;
};

/**
 * A key as the hero card draws it: mono name, sealed dots, version, and Reveal. Revealed, the
 * row lights amber, the value box turns exposed red with the countdown ring, and Copy and Hide
 * now sit under it.
 */
export function KeyRow({
  name,
  version,
  revealed,
  remaining,
  onReveal,
  onCopy,
  onHide,
}: KeyRowProps) {
  const open = revealed !== null;
  const row = useRef<HTMLLIElement>(null);
  const revealButton = useRef<HTMLButtonElement>(null);
  const copyButton = useRef<HTMLButtonElement>(null);
  // Whether keyboard focus is in this row. A focused button removed from the page may blur
  // with no relatedTarget, so only a move to somewhere else clears it.
  const focusInside = useRef(false);
  const wasOpen = useRef(open);

  // Revealing removes the Reveal button that was used, and hiding (Hide now, or the timer)
  // removes Copy and Hide now. Either way focus would drop to the page, so move it to the
  // control that replaced it. Focus that is somewhere else on the page stays there.
  useEffect(() => {
    if (open === wasOpen.current) return;
    wasOpen.current = open;
    const dropped = document.activeElement === null || document.activeElement === document.body;
    if (!dropped) return;
    if (open) copyButton.current?.focus();
    else if (focusInside.current) revealButton.current?.focus();
  }, [open]);

  return (
    <li
      ref={row}
      className="key-row border-b border-line px-5 py-4 sm:px-6"
      data-active={open}
      onFocus={() => {
        focusInside.current = true;
      }}
      onBlur={(e) => {
        if (e.relatedTarget && !row.current?.contains(e.relatedTarget)) focusInside.current = false;
      }}
    >
      <p role="status" className="sr-only">
        {open ? `${name} shown. It masks again in 30 seconds.` : ''}
      </p>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-[13px] font-medium text-ink" translate="no">
            {name}
          </p>
          {open ? null : (
            <p className="mt-1 sm:hidden">
              <span className="sr-only">Masked</span>
              <span aria-hidden className="sealed-dots font-mono text-[12px] tracking-[0.16em]">
                {ROW_MASK}
              </span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {open ? null : (
            <p className="hidden items-center sm:flex">
              <span className="sr-only">Masked</span>
              <span aria-hidden className="sealed-dots font-mono text-[13px] tracking-[0.16em]">
                {ROW_MASK}
              </span>
            </p>
          )}
          <span className="font-mono text-[11px] text-muted">v{version}</span>
          {open ? null : (
            <button type="button" ref={revealButton} onClick={onReveal} className={SMALL_QUIET}>
              Reveal for 30s
            </button>
          )}
        </div>
      </div>
      {open ? (
        <div className="mt-3">
          <div className="value-box px-3.5 py-3" data-state="revealed">
            <div className="flex min-h-7 items-center justify-between gap-3">
              <p
                className="unmask min-w-0 font-mono text-[15px] leading-6 break-all text-ink"
                translate="no"
              >
                {revealed}
              </p>
              <span aria-hidden className="shrink-0 text-exposed-ink">
                <CountdownRing ratio={revealRatio(remaining)} label="" size={22} />
              </span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-5 text-muted">
              Masks again in{' '}
              <span className="font-mono text-exposed-ink tabular-nums">
                {formatRevealSeconds(remaining)}
              </span>
              . One value at a time.
            </p>
            <div className="flex items-center gap-2">
              <button type="button" ref={copyButton} onClick={onCopy} className={SMALL_INK}>
                Copy
              </button>
              <button type="button" onClick={onHide} className={SMALL_QUIET}>
                Hide now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** Rows that breathe while the vault reads, so a slow load never looks like an empty one. */
export function RowsSkeleton({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div role="status" className="space-y-4 px-5 py-5 sm:px-6">
      <span className="sr-only">{label}</span>
      {[...Array(rows).keys()].map((row) => (
        <div key={row} aria-hidden className="flex items-center justify-between gap-4">
          <span className="skeleton h-3 w-40 max-w-[55%]" />
          <span className="skeleton h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/**
 * The empty vault: what a product is, where to make one, and the Next feature that will fill it
 * from a paste, labelled Next and with nothing that looks like it works today.
 */
export function EmptyProducts({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center sm:py-20">
      <div aria-hidden className="chip-card w-full max-w-[17rem] p-3 text-left">
        <div className="flex items-center gap-2 border-b border-line pb-2.5">
          <span className="grid h-6 w-6 place-items-center rounded-md border border-dashed border-line font-mono text-[10px] text-muted">
            ?
          </span>
          <span className="skeleton-static h-2.5 w-20" />
        </div>
        {[0, 1].map((row) => (
          <div key={row} className="flex items-center justify-between gap-3 pt-2.5">
            <span className="skeleton-static h-2 w-24" />
            <span className="sealed-dots font-mono text-[11px] tracking-[0.16em]">••••••</span>
          </div>
        ))}
      </div>
      <h2 className="mt-7 text-xl font-semibold tracking-[-0.02em] text-ink">No products yet</h2>
      <p className="mt-2 max-w-sm text-[15px] leading-6 text-pretty text-muted">
        A product holds the keys for one service, like Stripe or Postgres, under its own encryption
        key. Name your first one to start.
      </p>
      <div className="mt-6 w-full max-w-sm text-left">{children}</div>
      <div className="dashed-row mt-8 w-full max-w-sm px-4 py-3 text-left">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          Paste a messy block
          <StatusTag status="next" />
        </p>
        <p className="mt-1 text-xs leading-5 text-muted">
          Drop a .env or a pasted block and Secrelyte will sort it into products and keys, sealed on
          this device. Not shipped yet.
        </p>
      </div>
    </div>
  );
}

type ProductListProps = {
  products: Array<{ id: string; name: string; keys: number }>;
  selected: string | null;
  onSelect: (id: string) => void;
};

/**
 * The products: a scrolling chip row above the keys on a phone, the workspace's left rail on a
 * wide screen. Each button's accessible name is exactly the product's name; the tile and the
 * key count are decoration for sighted readers.
 */
export function ProductList({ products, selected, onSelect }: ProductListProps) {
  if (products.length === 0) return null;
  return (
    <ul className="product-list">
      {products.map((p) => (
        <li key={p.id} className="shrink-0 lg:shrink">
          <button
            type="button"
            onClick={() => onSelect(p.id)}
            aria-current={selected === p.id ? 'true' : undefined}
            className="product-item text-left"
          >
            <ProductTile name={p.name} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{p.name}</span>
            <span aria-hidden className="font-mono text-[11px] text-muted">
              {p.keys}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The selected product, headed as the hero card is: tile, name, environment, encrypted. */
export function ProductHeader({ name, environment }: { name: string; environment: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5 sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <ProductTile name={name} />
        <h2 className="truncate text-sm font-semibold tracking-tight text-ink">{name}</h2>
        <span className="pill">{environment}</span>
      </div>
      <p className="flex shrink-0 items-center gap-2 font-mono text-[11px] text-sealed-ink">
        <span aria-hidden className="sealed-dot" />
        encrypted
      </p>
    </div>
  );
}

export function NoKeys({ product }: { product: string }) {
  return (
    <div className="border-b border-line px-5 py-10 text-center sm:px-6">
      <p className="text-sm font-medium text-ink">No keys in {product} yet</p>
      <p className="mt-1 text-sm text-muted">
        Add one below. It is sealed before it leaves this tab.
      </p>
    </div>
  );
}

const CLIPBOARD_MESSAGE: Record<ClipboardState, string> = {
  idle: '',
  // "Tries": a browser can refuse a write that no click asked for, and the message then
  // switches to clear-pending. Nothing here promises a clear the browser decides.
  holding: `Copied. Secrelyte tries to clear the clipboard in ${CLIPBOARD_CLEAR_MS / 1000} seconds while this tab is open.`,
  'clear-pending':
    'The clipboard still holds the secret. Clear it now. Secrelyte also retries when you return to this tab.',
  cleared: 'Clipboard cleared.',
};

const CLIPBOARD_TONE: Record<ClipboardState, 'sealed' | 'attention' | 'error' | undefined> = {
  idle: undefined,
  holding: 'attention',
  'clear-pending': 'error',
  cleared: 'sealed',
};

/**
 * The clipboard's status, and a way to clear it by hand. A click counts as user activation,
 * which some browsers require for any clipboard write, so the button works even where the
 * timed clear is refused. In the open vault it is a band in the card whose status line stays
 * mounted while idle, so a screen reader hears it change; on the lock screen it is a notice.
 */
export function ClipboardNotice({
  clip,
  onClear,
  variant,
}: {
  clip: ClipboardState;
  onClear: () => void;
  variant: 'band' | 'notice';
}) {
  const tone = CLIPBOARD_TONE[clip];
  const canClear = clip === 'holding' || clip === 'clear-pending';
  return (
    <div
      className={
        variant === 'band' ? 'clip-band px-5 py-3 sm:px-6' : 'notice rise mb-10 px-4 py-3 text-left'
      }
      data-state={clip}
      data-tone={tone}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p
          role="status"
          className={`flex min-w-0 items-start gap-2.5 text-sm leading-6 ${clip === 'clear-pending' ? 'text-exposed-ink' : 'text-ink'}`}
        >
          {tone ? <span aria-hidden className="state-dot mt-[9px]" data-tone={tone} /> : null}
          {CLIPBOARD_MESSAGE[clip]}
        </p>
        {canClear ? (
          <button type="button" onClick={onClear} className={SMALL_QUIET}>
            Clear clipboard now
          </button>
        ) : null}
      </div>
    </div>
  );
}
