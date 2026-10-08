import { CLAUDE } from '@/lib/brand/landing-content';
import { ConfirmCard } from '@/components/landing/confirm-card';
import { SectionHeading } from '@/components/landing/section-heading';

function ReceivedByClaude() {
  return (
    <div className="chip-card flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
          What Claude will receive
        </p>
        <p className="flex items-center gap-1.5 font-mono text-[11px] text-sealed-ink">
          <span aria-hidden className="sealed-dot" />
          no values
        </p>
      </div>
      <pre className="code-block mt-4 overflow-x-auto p-4 whitespace-pre-wrap text-ink">
        <code>
          {'{\n'}
          {'  "request": "'}
          {CLAUDE.request}
          {'",\n'}
          {'  "product": "Stripe",\n'}
          {'  "keys": [\n'}
          {CLAUDE.keys.map((key, i) => `    "${key}"${i < CLAUDE.keys.length - 1 ? ',' : ''}\n`)}
          {'  ],\n'}
          {'  "values": '}
          <span className="text-sealed-ink">never included</span>
          {'\n}'}
        </code>
      </pre>
      <p className="mt-4 text-sm leading-6 text-muted">
        Names are enough to route a request. Values will stay encrypted and out of the prompt.
      </p>
    </div>
  );
}

export function ClaudeSection() {
  return (
    <section id="claude" aria-labelledby="claude-title" className="px-3 pt-28 sm:px-5 lg:pt-36">
      <div className="panel mx-auto grid max-w-[80rem] grid-cols-1 gap-x-10 gap-y-4 px-5 py-12 sm:px-10 lg:grid-cols-12 lg:px-14 lg:py-16">
        <div className="min-w-0 lg:col-span-7">
          <SectionHeading
            id="claude-title"
            eyebrow={CLAUDE.eyebrow}
            title={CLAUDE.title}
            lead={CLAUDE.lead}
            status={CLAUDE.status}
            align="start"
          />
          <div data-reveal className="mt-12 space-y-4">
            <div className="flex justify-end">
              <p className="max-w-md rounded-3xl rounded-br-lg bg-ink px-4 py-3 text-[15px] leading-6 text-paper">
                {CLAUDE.request}
              </p>
            </div>
            <div className="flex gap-3">
              <span
                aria-hidden
                className="mt-1 hidden h-7 w-7 shrink-0 place-items-center rounded-full border border-line bg-paper font-mono text-[11px] font-semibold text-ink sm:grid"
              >
                C
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted">
                  <span className="font-medium text-ink">Claude</span> will propose. Nothing runs
                  until you choose.
                </p>
                <div className="mt-3">
                  <ConfirmCard />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-5" data-reveal-group>
          <div data-reveal>
            <ReceivedByClaude />
          </div>
          <ul className="space-y-4">
            {CLAUDE.principles.map((principle, i) => (
              <li key={principle.title} data-reveal className="chip-card p-5">
                <p className="flex items-baseline gap-3">
                  <span className="font-mono text-xs text-muted">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[16px] font-semibold tracking-[-0.015em] text-ink">
                    {principle.title}
                  </span>
                </p>
                <p className="mt-2 pl-8 text-[15px] leading-6 text-muted">{principle.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
