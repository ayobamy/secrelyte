import Link from 'next/link';
import { Mark } from '@/components/mark';

type SiteHeaderProps = {
  variant?: 'marketing' | 'app';
  current?: 'vault' | 'share';
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
            <Link href={item.href} className={navClass(false)}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <span aria-hidden className="mx-1 hidden h-4 w-px bg-line md:block" />
      <Link href="/login" className={navClass(false)}>
        Unlock
      </Link>
      <Link
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

export function SiteHeader({ variant = 'marketing', current }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-20 px-3 pt-3 sm:px-6 sm:pt-4">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-6 focus:z-30 focus:bg-paper focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-full border border-line/70 bg-paper/80 py-2 pr-2 pl-3 shadow-pill backdrop-blur-md sm:pl-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-full py-1 pr-2 pl-1 text-ink no-underline"
        >
          <Mark size={22} />
          <span className="text-[15px] font-semibold tracking-tight">Secrelyte</span>
        </Link>
        {variant === 'marketing' ? (
          <MarketingNav />
        ) : (
          <nav aria-label="Primary" className="flex items-center gap-1 text-sm">
            <Link
              href="/vault"
              aria-current={current === 'vault' ? 'page' : undefined}
              className={navClass(current === 'vault')}
            >
              Vault
            </Link>
            <Link
              href="/s/preview"
              aria-current={current === 'share' ? 'page' : undefined}
              className={navClass(current === 'share')}
            >
              Share
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
