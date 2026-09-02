import Link from 'next/link';
import { HeroStage } from '@/components/hero-stage';
import { LightField } from '@/components/light-field';
import { ProductPreview } from '@/components/product-preview';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { HERO_BODY, HERO_EYEBROW, HERO_HEADLINE } from '@/lib/brand/hero-copy';

const steps = [
  {
    n: '01',
    title: 'Ask for it',
    body: 'Name the key. It appears on this device, masked. No folder tree.',
  },
  {
    n: '02',
    title: 'Send it',
    body: 'A link that expires. The recipient proves the inbox. You see when it opened.',
  },
  {
    n: '03',
    title: 'Watch it expire',
    body: 'Revoke immediately. A viewed key cannot be un-seen. Rotate it.',
  },
];

const limits = [
  'We cannot read your secrets. The server stores ciphertext.',
  'The model proposes. A click of yours executes.',
  'If you lose the password and the recovery kit, the data is gone.',
];

export default function Home() {
  return (
    <div className="relative">
      <LightField />
      <SiteHeader />
      <main id="content">
        <HeroStage>
          <div className="lg:col-span-5">
            <p className="text-xs font-medium tracking-[0.22em] text-muted uppercase">
              {HERO_EYEBROW}
            </p>
            <h1 className="mt-5 text-[2.9rem] leading-[0.95] font-semibold tracking-[-0.045em] text-ink sm:text-6xl lg:text-[4.5rem]">
              {HERO_HEADLINE.map((line, i) => {
                const last = i === HERO_HEADLINE.length - 1;
                const delay =
                  i === 0 ? 'settle' : i === 1 ? 'settle settle-delay-1' : 'settle settle-delay-2';
                return (
                  <span
                    key={line}
                    className={last ? `block leading-[1.12] ${delay}` : `block ${delay}`}
                  >
                    {line}
                  </span>
                );
              })}
              <span className="hero-rule" aria-hidden />
            </h1>
            <p className="settle settle-delay-3 mt-10 max-w-md text-lg leading-8 text-muted">
              {HERO_BODY}
            </p>
            <div className="settle settle-delay-4 mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/vault"
                className="ink-shine cta-shine group inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-paper no-underline transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-ink/90 active:scale-[0.98]"
              >
                Open the vault
                <span
                  aria-hidden
                  className="nudge grid h-7 w-7 place-items-center rounded-full bg-signal text-sm font-semibold text-ink transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:scale-105"
                >
                  →
                </span>
              </Link>
              <Link
                href="/s/preview"
                className="rounded-full px-5 py-3 text-ink no-underline ring-1 ring-line transition-colors hover:bg-paper"
              >
                See a share
              </Link>
            </div>
          </div>
          <div className="settle settle-delay-1 lg:col-span-7">
            <ProductPreview />
          </div>
        </HeroStage>

        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <p className="max-w-2xl text-2xl leading-9 font-medium tracking-tight text-ink">
              Ciphertext in the database. Keys on this device. The model sees placeholders.
            </p>
            <p className="mt-4 max-w-xl leading-7 text-muted">
              Blobs we cannot open. Unlock never leaves the browser. A click of yours executes.
            </p>
          </div>
        </section>

        <section className="border-t border-line bg-paper">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="text-2xl font-semibold tracking-tight">Ask. Send. Watch it expire.</h2>
            <ol className="mt-12 space-y-10">
              {steps.map((step) => (
                <li
                  key={step.n}
                  className="grid gap-3 border-t border-line pt-8 sm:grid-cols-12 sm:items-baseline"
                >
                  <p className="font-mono text-sm text-signal-ink sm:col-span-2">{step.n}</p>
                  <h3 className="text-xl font-semibold sm:col-span-3">{step.title}</h3>
                  <p className="text-muted sm:col-span-7">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-semibold tracking-tight">Limits, stated.</h2>
          <ul className="mt-8 max-w-2xl space-y-4">
            {limits.map((line) => (
              <li key={line} className="flex gap-3 text-[17px] leading-7 text-ink">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                {line}
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
