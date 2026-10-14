import Link from 'next/link';
import type { ReactNode } from 'react';
import { Beacon, EASE, Eyebrow, StateDot } from '@/components/ui';

type AuthShellProps = {
  /** The page's SiteHeader, chosen by the route: auth, app or marketing. */
  header: ReactNode;
  eyebrow: ReactNode;
  title: string;
  lead?: ReactNode;
  /** narrow for a form, wide for the recovery kit's three-word row. */
  width?: 'narrow' | 'wide';
  /** Notices that belong above the heading, such as the clipboard status after a lock. */
  notice?: ReactNode;
  busy?: boolean;
  /** The app footer and its links. Off on the recovery kit, which must not be left early. */
  footer?: boolean;
  children: ReactNode;
};

/**
 * The sign-in column: the mark drawn large, an eyebrow, one heading, a short lead, then a card.
 * Every screen a person passes through on the way into the vault uses it, so signup, unlock,
 * the recovery kit, the locked vault and not-found read as one product.
 */
export function AuthShell({
  header,
  eyebrow,
  title,
  lead,
  width = 'narrow',
  notice,
  busy,
  footer = true,
  children,
}: AuthShellProps) {
  return (
    <div className="app-field flex min-h-full flex-col">
      {header}
      <main
        id="content"
        aria-busy={busy || undefined}
        className="flex flex-1 flex-col px-4 pt-10 pb-16 sm:px-6 sm:pt-14"
      >
        <div className={`mx-auto w-full ${width === 'wide' ? 'max-w-[30rem]' : 'max-w-[27rem]'}`}>
          {notice}
          <div className="settle text-center">
            <Beacon />
            <div className="mt-5">
              <Eyebrow center>{eyebrow}</Eyebrow>
            </div>
            <h1 className="mt-4 text-[2.25rem] leading-[1.05] font-semibold tracking-[-0.04em] text-balance text-ink sm:text-[2.6rem]">
              {title}
            </h1>
            {lead ? (
              <p className="mx-auto mt-4 max-w-[25rem] text-[15px] leading-6 text-pretty text-muted sm:text-[16px] sm:leading-7">
                {lead}
              </p>
            ) : null}
          </div>
          <div className="settle settle-delay-1 mt-8">{children}</div>
        </div>
      </main>
      {footer ? <AppFooter /> : null}
    </div>
  );
}

/** The hero card's frame: a translucent bezel around a paper card. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bezel ${className}`}>
      <div className="bezel-inner">{children}</div>
    </div>
  );
}

export function CardBody({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`px-5 py-6 sm:px-7 sm:py-7 ${className}`}>{children}</div>;
}

/** The quiet sentence under a form, where the other route lives: "New here? Create a vault". */
export function CardLinkBand({ children }: { children: ReactNode }) {
  return (
    <div className="border-t border-line px-5 py-4 text-center text-sm text-muted sm:px-7">
      {children}
    </div>
  );
}

/**
 * The hero card's footer: mono, one line of fact, no closing period. The dot is sealed green
 * only when the line states something sealed; a closed or pending state takes the neutral dot.
 */
export function CardFactBand({
  children,
  aside,
  tone = 'sealed',
}: {
  children: ReactNode;
  aside?: ReactNode;
  tone?: 'sealed' | 'neutral';
}) {
  return (
    <div className="card-band flex items-center justify-between gap-3 px-5 py-2.5 font-mono text-[11px] leading-5 text-muted sm:px-7">
      <p className="flex min-w-0 items-center gap-2">
        <StateDot tone={tone === 'sealed' ? 'sealed' : undefined} />
        <span>{children}</span>
      </p>
      {aside ? <p className="hidden shrink-0 text-right sm:block">{aside}</p> : null}
    </div>
  );
}

const FOOTER_LINKS = [
  { href: '/#how', label: 'How it works' },
  { href: '/#guarantee', label: 'Security' },
  { href: '/#limits', label: 'Limits' },
] as const;

/** One quiet line under every app screen: the brand line and the way back to the story. */
export function AppFooter() {
  return (
    <footer className="px-4 pb-6 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-line/80 pt-5 text-[13px] text-muted sm:flex-row">
        <p>Your secrets, in the light.</p>
        <nav aria-label="Footer">
          <ul className="flex items-center gap-1">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  prefetch
                  href={link.href}
                  className={`rounded-full px-2.5 py-1.5 text-muted transition-colors ${EASE} hover:text-ink`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
