import { CountdownRing } from '@/components/countdown-ring';
import { PreviewButton } from '@/components/landing/preview-button';
import { StatusTag } from '@/components/landing/status-tag';
import { CLAUDE, DEMO_KEY_NAME, DEMO_SECRET } from '@/lib/brand/landing-content';

/*
 * Product moments for the four steps. In the Live panels, controls are illustrations (the hero
 * card is the operable demo). In the Next panels, controls are real buttons that say plainly
 * that nothing happened, because the capability has not shipped.
 */

const PRODUCTS = [
  { name: 'Stripe', env: 'production', keys: 3, active: true },
  { name: 'Postgres', env: 'staging', keys: 2, active: false },
  { name: 'Resend', env: 'production', keys: 1, active: false },
] as const;

/** The Hide control as drawn in the static Reveal illustration; the hero card is the real one. */
function FauxButton({ children }: { children: string }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-8 shrink-0 items-center rounded-full bg-paper px-3.5 text-[13px] text-ink ring-1 ring-line"
    >
      {children}
    </span>
  );
}

export function PickFragment() {
  return (
    <div className="space-y-3">
      <div className="dashed-box flex items-center justify-between gap-3 px-4 py-3">
        <p className="min-w-0 text-sm text-muted">Ask for a key in plain language</p>
        <StatusTag status="next" className="shrink-0" />
      </div>
      <div className="chip-card overflow-hidden">
        <ul aria-label="Products">
          {PRODUCTS.map((p) => (
            <li
              key={p.name}
              className="key-row flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0"
              data-active={p.active ? 'true' : 'false'}
            >
              <p className="flex min-w-0 items-center gap-2.5">
                <span className={p.active ? 'font-semibold text-ink' : 'text-ink'}>{p.name}</span>
                <span className="pill">{p.env}</span>
              </p>
              <p className="shrink-0 font-mono text-[11px] text-muted max-[400px]:hidden">
                {p.keys} {p.keys === 1 ? 'key' : 'keys'}
              </p>
            </li>
          ))}
        </ul>
        <div className="border-t border-line bg-base px-4 py-3">
          <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="font-mono text-[12.5px] font-medium text-ink">{DEMO_KEY_NAME}</span>
            <span className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-sealed-ink">
              <span aria-hidden className="sealed-dot shrink-0" />
              ciphertext until revealed
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export function RevealFragment() {
  return (
    <div className="chip-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[12.5px] font-medium text-ink">{DEMO_KEY_NAME}</p>
        <p className="font-mono text-[11px] text-muted">v3</p>
      </div>
      <div className="value-box mt-3 px-3.5 py-3" data-state="revealed">
        <div className="flex h-7 items-center justify-between gap-3">
          <p className="min-w-0 truncate font-mono text-[15px] text-ink" translate="no">
            {DEMO_SECRET}
          </p>
          <span aria-hidden className="shrink-0 text-exposed-ink">
            <CountdownRing ratio={0.7} label="" size={22} />
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-muted">
          Plaintext on screen. Masks again in{' '}
          <span className="font-mono text-exposed-ink">21s</span>
        </p>
        <FauxButton>Hide now</FauxButton>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
        <p className="font-mono text-[12.5px] text-muted">STRIPE_WEBHOOK_SECRET</p>
        <p className="flex items-center gap-2">
          <span className="sr-only">Masked</span>
          <span aria-hidden className="sealed-dots font-mono text-[13px] tracking-[0.16em]">
            ••••••••
          </span>
        </p>
      </div>
    </div>
  );
}

export function SendFragment() {
  const rows = [
    ['To', CLAUDE.recipient],
    ['Expires', '24 hours'],
    ['View limit', '3 views'],
    ['Recipient', 'Proves the inbox with a code'],
  ] as const;
  return (
    <div className="chip-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">New share link</p>
        <StatusTag status="next" />
      </div>
      <p className="mt-1 font-mono text-[11.5px] text-muted">Stripe · {DEMO_KEY_NAME}</p>
      <dl className="mt-4 divide-y divide-line rounded-2xl border border-line">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 px-3.5 py-2.5 text-sm"
          >
            <dt className="text-muted">{label}</dt>
            <dd className="text-right text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <PreviewButton
        label="Create link"
        hint="Designed, not shipped."
        response="Preview only. Share links are Next, so no link was created."
      />
    </div>
  );
}

export function WatchFragment() {
  return (
    <div className="chip-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-ink">
          {DEMO_KEY_NAME} <span className="font-normal text-muted">to {CLAUDE.recipient}</span>
        </p>
        <StatusTag status="next" />
      </div>
      <ol className="mt-4 space-y-3 border-l border-line pl-4">
        <li className="relative text-sm text-ink">
          <span
            aria-hidden
            className="absolute top-1.5 -left-[1.3rem] h-2 w-2 rounded-full bg-ink ring-4 ring-paper"
          />
          Opened, code verified
          <span className="block text-xs text-muted">2 minutes ago · 1 of 3 views used</span>
        </li>
        <li className="relative text-sm text-ink">
          <span
            aria-hidden
            className="absolute top-1.5 -left-[1.3rem] h-2 w-2 rounded-full bg-line ring-4 ring-paper"
          />
          Link created
          <span className="block text-xs text-muted">22 hours ago · 24-hour expiry</span>
        </li>
      </ol>
      <div className="mt-4 rounded-2xl border border-line px-3.5 py-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted">Expires in</span>
          <span className="font-mono text-signal-ink">1h 52m</span>
        </div>
        <div aria-hidden className="mt-2 h-1 overflow-hidden rounded-full bg-line">
          <div className="h-full w-[8%] rounded-full bg-signal" />
        </div>
      </div>
      <PreviewButton
        label="Revoke"
        tone="exposed"
        hint="Revoking cannot un-see a viewed key. Rotate it."
        response="Preview only. Revocation is Next, so nothing changed."
      />
    </div>
  );
}
