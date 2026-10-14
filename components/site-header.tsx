import Link from 'next/link';
import type { ReactNode } from 'react';
import { Mark } from '@/components/mark';

type SiteHeaderProps = {
  /**
   * marketing: the landing's full nav. app: Vault and Share, for a signed-in session. auth: the
   * sign-in screens, which have one job, so the nav shrinks to the other sign-in route.
   */
  variant?: 'marketing' | 'app' | 'auth';
  current?: 'vault' | 'share';
  /** The auth variant's single link: Unlock on signup, Create a vault on login. */
  authLink?: { href: '/login' | '/signup'; label: string };
  /** Keeps the header in view while the page scrolls. The landing page always does. */
  sticky?: boolean;
  /** A control that must stay in reach, after the nav: the open vault's Lock. */
  action?: ReactNode;
  /**
   * An opaque pill. Translucent over the landing hero; solid on the app screens, whose light
   * from above would otherwise tint it.
   */
  solid?: boolean;
  /**
   * The mark alone, unlinked, with no nav. For the recovery kit before it is saved: the kit
   * lives only in this tab, so the header offers no way off the page.
   */
  bare?: boolean;
};

const MARKETING_SECTIONS = [
  { href: '/#how', label: 'How it works' },
  { href: '/#guarantee', label: 'Security' },
  { href: '/#limits', label: 'Limits' },
  { href: '/#faq', label: 'FAQ' },
] as const;

const ease = 'duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]';

function navClass(active: boolean) {
  return active
    ? 'rounded-full bg-base px-3 py-1.5 font-medium text-ink'
    : `rounded-full px-3 py-1.5 text-muted transition-colors ${ease} hover:text-ink`;
}

function MarketingNav() {
  return (
    <nav aria-label="Primary" className="flex items-center gap-1 text-sm">
      <ul className="hidden items-center gap-1 md:flex">
        {MARKETING_SECTIONS.map((item) => (
          <li key={item.href}>
            <Link prefetch href={item.href} className={navClass(false)}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <span aria-hidden className="mx-1 hidden h-4 w-px bg-line md:block" />
      <Link prefetch href="/login" className={navClass(false)}>
        Unlock
      </Link>
      <Link
        prefetch
        href="/signup"
        className={`group ml-1 inline-flex items-center gap-2 rounded-full bg-ink py-1.5 pr-1.5 pl-3.5 text-paper no-underline transition-transform ${ease} hover:bg-ink/90 active:scale-[0.98]`}
      >
        Create a vault
        <span
          aria-hidden
          className={`grid h-5 w-5 place-items-center rounded-full bg-signal text-[11px] font-semibold text-ink transition-transform ${ease} group-hover:translate-x-0.5`}
        >
          →
        </span>
      </Link>
    </nav>
  );
}

function AppNav({ current }: { current?: SiteHeaderProps['current'] }) {
  return (
    <nav aria-label="Primary" className="flex items-center gap-1 text-sm">
      <Link
        prefetch
        href="/vault"
        aria-current={current === 'vault' ? 'page' : undefined}
        className={navClass(current === 'vault')}
      >
        Vault
      </Link>
      <Link
        prefetch
        href="/s/preview"
        aria-current={current === 'share' ? 'page' : undefined}
        className={navClass(current === 'share')}
      >
        Share
      </Link>
    </nav>
  );
}

function AuthNav({ link }: { link: NonNullable<SiteHeaderProps['authLink']> }) {
  return (
    <nav aria-label="Primary" className="flex items-center text-sm">
      <Link
        prefetch
        href={link.href}
        className={`rounded-full px-3.5 py-1.5 font-medium text-ink no-underline ring-1 ring-line transition-colors ${ease} hover:bg-base`}
      >
        {link.label}
      </Link>
    </nav>
  );
}

function HeaderNav({ variant, current, authLink }: SiteHeaderProps) {
  if (variant === 'app') return <AppNav current={current} />;
  if (variant === 'auth') return authLink ? <AuthNav link={authLink} /> : null;
  return <MarketingNav />;
}

export function SiteHeader({
  variant = 'marketing',
  current,
  authLink,
  sticky = variant === 'marketing',
  action,
  solid = variant !== 'marketing',
  bare = false,
}: SiteHeaderProps) {
  const brand = (
    <>
      <Mark size={22} />
      <span className="text-[15px] font-semibold tracking-tight">Secrelyte</span>
    </>
  );
  return (
    // Sticky on the long landing page and the open vault, where Lock has to stay in reach. The
    // sign-in columns are short, and a sticky header would only cover their heading.
    <header className={`${sticky ? 'sticky top-0' : 'relative'} z-20 px-3 pt-3 sm:px-6 sm:pt-4`}>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-6 focus:z-30 focus:bg-paper focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-full border border-line/70 py-2 pr-2 pl-3 shadow-pill sm:pl-4 ${solid ? 'bg-paper' : 'bg-paper/80 backdrop-blur-md'}`}
      >
        {bare ? (
          <span className="flex shrink-0 items-center gap-2 py-1 pr-2 pl-1 text-ink">{brand}</span>
        ) : (
          <Link
            prefetch
            href="/"
            className="flex shrink-0 items-center gap-2 rounded-full py-1 pr-2 pl-1 text-ink no-underline"
          >
            {brand}
          </Link>
        )}
        {bare ? null : (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <HeaderNav variant={variant} current={current} authLink={authLink} />
            {action ? (
              <>
                <span aria-hidden className="h-4 w-px bg-line" />
                {action}
              </>
            ) : null}
          </div>
        )}
      </div>
    </header>
  );
}
