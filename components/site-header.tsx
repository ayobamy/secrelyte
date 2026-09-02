import Link from 'next/link';
import { Mark } from '@/components/mark';

type SiteHeaderProps = {
  variant?: 'marketing' | 'app';
  current?: 'vault' | 'share';
};

function navClass(active: boolean) {
  return active
    ? 'rounded-full bg-base px-3 py-1.5 font-medium text-ink'
    : 'rounded-full px-3 py-1.5 text-muted transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-ink';
}

export function SiteHeader({ variant = 'marketing', current }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-20 px-4 pt-4 sm:px-6">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-4 focus:z-30 focus:bg-paper focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-line/70 bg-paper/75 px-4 py-2 shadow-[0_8px_30px_rgba(14,17,22,0.04)] backdrop-blur-md">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 text-ink no-underline"
        >
          <Mark size={22} />
          <span className="text-[15px] font-semibold tracking-tight">Secrelyte</span>
        </Link>
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
          {variant === 'marketing' ? (
            <Link
              href="/vault"
              className="group ml-1 hidden items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-paper no-underline transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-ink/90 active:scale-[0.98] sm:inline-flex"
            >
              Open vault
              <span
                aria-hidden
                className="grid h-5 w-5 place-items-center rounded-full bg-signal text-[11px] font-semibold text-ink transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
