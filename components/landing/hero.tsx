import Link from 'next/link';
import { ProductPreview } from '@/components/product-preview';
import { StatusTag } from '@/components/landing/status-tag';
import { LIVE_STRIP } from '@/lib/brand/landing-content';
import { HERO_BODY, HERO_EYEBROW, HERO_HEADLINE } from '@/lib/brand/hero-copy';

const ease = 'duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]';

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="hero-panel panel mx-auto max-w-[80rem]">
        <div aria-hidden className="hero-light" />
        <div aria-hidden className="hero-grid" />
        <div aria-hidden className="hero-rays" />

        <div className="grid grid-cols-1 items-center gap-14 px-5 pt-12 pb-12 sm:px-10 sm:pt-16 lg:grid-cols-12 lg:gap-8 lg:px-14 lg:pt-20 lg:pb-16">
          <div className="lg:col-span-6">
            <p className="settle flex items-center gap-3 text-xs font-medium tracking-[0.2em] text-muted uppercase">
              <span aria-hidden className="h-px w-7 bg-signal" />
              {HERO_EYEBROW}
            </p>
            <h1
              id="hero-title"
              className="settle settle-delay-1 mt-6 max-w-[15ch] text-[2.75rem] leading-[1] font-semibold tracking-[-0.045em] text-balance text-ink sm:text-6xl lg:text-[4.5rem] lg:leading-[0.98]"
            >
              {HERO_HEADLINE}
            </h1>
            <p className="settle settle-delay-2 mt-7 max-w-[34rem] text-lg leading-8 text-pretty text-muted sm:text-[19px]">
              {HERO_BODY}
            </p>
            <div className="settle settle-delay-3 mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/signup"
                className={`ink-shine cta-shine group inline-flex items-center justify-center gap-3 rounded-full bg-ink py-3 pr-2 pl-6 text-[15px] font-medium text-paper no-underline transition-transform ${ease} hover:bg-ink/90 active:scale-[0.98]`}
              >
                Create a vault
                <span
                  aria-hidden
                  className={`nudge grid h-8 w-8 place-items-center rounded-full bg-signal text-sm font-semibold text-ink transition-transform ${ease} group-hover:translate-x-0.5`}
                >
                  →
                </span>
              </Link>
              <Link
                href="#how"
                className={`inline-flex items-center justify-center rounded-full bg-paper px-6 py-3.5 text-[15px] text-ink no-underline ring-1 ring-line transition-colors ${ease} hover:bg-base`}
              >
                See how it works
              </Link>
            </div>
            <p className="settle settle-delay-4 mt-6 text-sm text-muted">
              Already have a vault?{' '}
              <Link
                href="/login"
                className="font-medium text-ink underline decoration-line decoration-2 underline-offset-4 hover:decoration-signal"
              >
                Unlock
              </Link>
            </p>
          </div>

          <div className="settle settle-delay-2 lg:col-span-6 lg:pl-8">
            <ProductPreview />
          </div>
        </div>

        <div className="flex flex-col gap-5 border-t border-line/80 px-5 py-6 sm:px-10 lg:flex-row lg:items-center lg:gap-10 lg:px-14">
          <p className="flex shrink-0 items-center gap-2.5 text-sm font-medium text-ink">
            <StatusTag status="live" />
            today
          </p>
          <ul
            aria-label="Live today"
            className="grid flex-1 grid-cols-1 gap-x-6 gap-y-3 min-[420px]:grid-cols-2 lg:grid-cols-4"
          >
            {LIVE_STRIP.map((item) => (
              <li
                key={item}
                className="min-w-0 text-sm text-ink lg:border-l lg:border-line lg:pl-5"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
