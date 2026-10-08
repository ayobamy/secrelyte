import Link from 'next/link';
import { CLOSING } from '@/lib/brand/landing-content';

const ease = 'duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]';

export function Closing() {
  return (
    <section aria-labelledby="closing-title" className="px-3 pt-28 pb-3 sm:px-5 sm:pb-5 lg:pt-36">
      <div data-reveal className="closing-panel hero-panel panel mx-auto max-w-[80rem]">
        <div aria-hidden className="hero-light" />
        <div aria-hidden className="hero-rays" />
        <div className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-10 lg:py-28">
          <div aria-hidden className="mx-auto mb-10 flex w-fit flex-col items-center">
            <span className="closing-beam" />
            <span className="closing-node" />
            <svg className="closing-split h-12 w-32" viewBox="0 0 128 48" focusable="false">
              <path d="M64 0 L12 46" />
              <path d="M64 0 L64 48" />
              <path d="M64 0 L116 46" />
            </svg>
          </div>
          <h2
            id="closing-title"
            className="text-[2.5rem] leading-[1.02] font-semibold tracking-[-0.045em] text-balance text-ink sm:text-6xl lg:text-[4rem]"
          >
            {CLOSING.title}
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-muted">{CLOSING.lead}</p>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href="/signup"
              className={`ink-shine group inline-flex items-center justify-center gap-3 rounded-full bg-ink py-3 pr-2 pl-6 text-[15px] font-medium text-paper no-underline transition-transform ${ease} hover:bg-ink/90 active:scale-[0.98]`}
            >
              Create a vault
              <span
                aria-hidden
                className={`grid h-8 w-8 place-items-center rounded-full bg-signal text-sm font-semibold text-ink transition-transform ${ease} group-hover:translate-x-0.5`}
              >
                →
              </span>
            </Link>
            <Link
              href="/login"
              className={`inline-flex items-center justify-center rounded-full bg-paper px-6 py-3.5 text-[15px] text-ink no-underline ring-1 ring-line transition-colors ${ease} hover:bg-base`}
            >
              Unlock your vault
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
