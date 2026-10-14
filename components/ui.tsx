import type { ReactNode } from 'react';

/**
 * The small vocabulary every app screen shares with the landing page: the ease curve, the ink
 * CTA with its amber arrow, the quiet ring button, the text link, the eyebrow and the mark drawn
 * large. Class strings rather than wrapper components where the element varies (a button on one
 * screen, a Link on another), so each call site keeps its own element and props.
 */
export const EASE = 'duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]';

/** The landing CTA at full width: ink pill, amber arrow. Disabled reads as unavailable, not gone. */
export const PRIMARY_BUTTON = `ink-shine group inline-flex h-12 w-full items-center justify-center gap-3 rounded-full bg-ink pr-2 pl-6 text-[15px] font-medium text-paper no-underline transition-[transform,background-color,opacity] ${EASE} hover:bg-ink/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-ink disabled:active:scale-100`;

/** The landing's secondary action: paper pill with a hairline ring. */
export const QUIET_BUTTON = `inline-flex h-12 items-center justify-center gap-2 rounded-full bg-paper px-6 text-[15px] text-ink no-underline ring-1 ring-line transition-colors ${EASE} hover:bg-base`;

/** Pills for actions inside a card: rows (Reveal, Copy, Hide now) and the forms beside them. */
const PILL = `inline-flex shrink-0 items-center justify-center gap-2 rounded-full transition-[transform,background-color,opacity] ${EASE} active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100`;
const PILL_INK = `${PILL} bg-ink text-paper hover:bg-ink/90`;
const PILL_RING = `${PILL} bg-paper text-ink ring-1 ring-line hover:bg-base`;
export const SMALL_INK = `${PILL_INK} h-9 px-4 text-sm`;
export const SMALL_QUIET = `${PILL_RING} h-9 px-4 text-sm`;
/** Level with a compact field, so the input and its button share a baseline. */
export const FIELD_INK = `${PILL_INK} h-11 px-4 text-sm`;
export const FIELD_QUIET = `${PILL_RING} h-11 px-4 text-sm`;
/** The open vault's Lock, inside the header pill, level with its nav links. */
export const LOCK_BUTTON = `${PILL_RING} h-8 px-3 text-sm font-medium`;

/**
 * A link inside a sentence. Always underlined in amber, so it reads as a link before any hover;
 * the underline turns ink on hover. The vertical padding grows the tap target past 24px without
 * moving the line.
 */
export const TEXT_LINK = `rounded-sm py-1 font-medium text-ink underline decoration-signal decoration-2 underline-offset-4 transition-colors ${EASE} hover:decoration-ink`;

/** The amber arrow that rides on every primary action, as on the landing CTA. */
export function ArrowDot() {
  return (
    <span
      aria-hidden
      className={`nudge grid h-8 w-8 shrink-0 place-items-center rounded-full bg-signal text-sm font-semibold text-ink transition-transform ${EASE} group-hover:translate-x-0.5`}
    >
      →
    </span>
  );
}

/** Stands in for the arrow while a button works, so the button keeps its size. */
export function BusyDot() {
  return (
    <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center">
      <span className="spinner text-paper" />
    </span>
  );
}

/** The landing eyebrow: an amber hairline, then tracked uppercase. */
export function Eyebrow({ children, center = false }: { children: ReactNode; center?: boolean }) {
  return (
    <p
      className={`flex items-center gap-3 text-xs font-medium tracking-[0.2em] text-muted uppercase ${center ? 'justify-center' : ''}`}
    >
      <span aria-hidden className="h-px w-6 bg-signal" />
      {children}
      {center ? <span aria-hidden className="h-px w-6 bg-signal" /> : null}
    </p>
  );
}

/** The mark drawn large, as in the landing's closing panel: a beam, the node, three keys. */
export function Beacon() {
  return (
    <div aria-hidden className="beacon">
      <span className="beacon-beam" />
      <span className="beacon-node" />
      <svg className="beacon-split h-8 w-20" viewBox="0 0 80 32" focusable="false">
        <path d="M40 0 L6 30" />
        <path d="M40 0 L40 32" />
        <path d="M40 0 L74 30" />
      </svg>
    </div>
  );
}

/** A coloured state dot: sealed green, attention amber, exposed red, or neutral. */
export function StateDot({ tone }: { tone?: 'sealed' | 'attention' | 'error' }) {
  return <span aria-hidden className="state-dot" data-tone={tone} />;
}

/** A failure, announced, in one sentence. The element holds only the message text. */
export function InlineAlert({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div
      id={id}
      role="alert"
      className="notice rise flex items-start gap-2.5 px-4 py-3 text-sm leading-6 text-exposed-ink"
      data-tone="error"
    >
      <span aria-hidden className="state-dot mt-[9px]" data-tone="error" />
      <p className="min-w-0">{children}</p>
    </div>
  );
}

/** A field's own error: under the field, announced, and referenced by its aria-describedby. */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="field-message mt-2" data-tone="error">
      {children}
    </p>
  );
}
