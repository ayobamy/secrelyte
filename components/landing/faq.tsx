import { FAQ } from '@/lib/brand/landing-content';
import { SectionHeading } from '@/components/landing/section-heading';

/** Native details/summary: keyboard and screen-reader behaviour for free, no client JS. */
export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="px-3 pt-28 sm:px-5 lg:pt-36">
      <div className="mx-auto max-w-[80rem]">
        <SectionHeading id="faq-title" eyebrow={FAQ.eyebrow} title={FAQ.title} />
        <ol className="mx-auto mt-14 max-w-4xl space-y-3 lg:mt-16" data-reveal-group>
          {FAQ.items.map((item, i) => (
            <li key={item.q} data-reveal>
              <details className="faq-item group rounded-3xl border border-line bg-paper transition-colors duration-300">
                <summary className="flex items-center gap-4 rounded-3xl px-5 py-5 sm:px-7 sm:py-6">
                  <span className="w-7 shrink-0 font-mono text-xs text-muted">
                    {String(i + 1).padStart(2, '0')}.
                  </span>
                  <span className="flex-1 text-[17px] font-medium tracking-[-0.015em] text-ink sm:text-xl">
                    {item.q}
                  </span>
                  <span
                    aria-hidden
                    className="faq-icon grid h-9 w-9 shrink-0 place-items-center rounded-full bg-base text-lg text-ink ring-1 ring-line"
                  >
                    +
                  </span>
                </summary>
                <div className="faq-body px-5 pb-6 sm:pr-20 sm:pl-[4.75rem]">
                  <p className="max-w-2xl text-[15px] leading-7 text-muted">{item.a}</p>
                </div>
              </details>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
