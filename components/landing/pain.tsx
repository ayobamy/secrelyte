import type { ReactNode } from 'react';
import { PAIN } from '@/lib/brand/landing-content';

const [retrieval, handoff, links] = PAIN.cards;

function PainCard({
  n,
  tags,
  title,
  body,
  children,
  className = '',
}: {
  n: string;
  tags: readonly string[];
  title: string;
  body: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article data-reveal className={`panel flex flex-col p-6 sm:p-7 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="pill">
              {tag}
            </span>
          ))}
        </div>
        <span className="font-mono text-xs text-muted">{n}</span>
      </div>
      <h3 className="mt-5 text-lg font-semibold tracking-[-0.015em] text-ink">{title}</h3>
      <p className="mt-2 text-[15px] leading-6 text-muted">{body}</p>
      <div className="mt-6 flex flex-1 flex-col justify-end">{children}</div>
    </article>
  );
}

function RetrievalSteps() {
  return (
    <ol className="space-y-1.5" aria-label="Five interactions">
      {retrieval.steps.map((step, i) => {
        const last = i === retrieval.steps.length - 1;
        return (
          <li
            key={step}
            className={
              last
                ? 'flex h-9 items-center gap-3 rounded-xl bg-ink px-3 text-sm text-paper'
                : 'flex h-9 items-center gap-3 rounded-xl border border-line bg-base px-3 text-sm text-ink'
            }
          >
            <span
              className={last ? 'font-mono text-xs text-paper/70' : 'font-mono text-xs text-muted'}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            {step}
            {last ? (
              <span className="ml-auto font-mono text-[11px] text-paper/70">5 of 5</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function Timeline() {
  return (
    <div>
      <p className="font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">
        {PAIN.timelineLabel}
      </p>
      <ol className="mt-4 space-y-4 border-l border-line pl-5">
        {PAIN.timeline.map((event) => (
          <li key={event.when} className="relative">
            <span
              aria-hidden
              className={
                event.tone === 'exposed'
                  ? 'absolute top-1.5 -left-[1.53rem] h-2.5 w-2.5 rounded-full bg-exposed ring-4 ring-paper'
                  : 'absolute top-1.5 -left-[1.53rem] h-2.5 w-2.5 rounded-full border border-line bg-paper ring-4 ring-paper'
              }
            />
            <p className="font-mono text-xs text-muted">{event.when}</p>
            <p
              className={
                event.tone === 'exposed'
                  ? 'mt-0.5 text-[15px] font-medium text-exposed-ink'
                  : 'mt-0.5 text-[15px] text-ink'
              }
            >
              {event.what}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function LeakedMessage() {
  return (
    <div className="rounded-2xl border border-line bg-base p-3.5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-paper"
        >
          Y
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted">
            <span className="font-medium text-ink">you</span> · 14:02
          </p>
          <p className="mt-1 text-sm text-ink">prod key for the webhook, keep it safe</p>
          <p className="leak-line mt-1.5 truncate font-mono text-[12px] text-ink" translate="no">
            STRIPE_SECRET_KEY=sk_live_demo_4eQx9mT2…
          </p>
        </div>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-2.5 font-mono text-[11px] text-exposed-ink">
        plaintext <span aria-hidden>·</span> permanent <span aria-hidden>·</span> in a search index
      </p>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Where handoffs end up">
        {handoff.channels.map((channel) => (
          <li key={channel} className="pill">
            {channel}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LinkSettings() {
  return (
    <ul
      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      aria-label="Steps to send a secure link today"
    >
      {links.settings.map((setting, i) => {
        const skipped = i >= links.settings.length - 2;
        return (
          <li
            key={setting}
            className={
              skipped
                ? 'flex items-center gap-2.5 rounded-xl border border-dashed border-line px-3 py-2 text-sm text-muted'
                : 'flex items-center gap-2.5 rounded-xl border border-line bg-base px-3 py-2 text-sm text-ink'
            }
          >
            <span
              aria-hidden
              className={
                skipped
                  ? 'h-3.5 w-3.5 shrink-0 rounded-[4px] border border-line bg-paper'
                  : 'grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[4px] bg-ink text-[9px] leading-none text-paper'
              }
            >
              {skipped ? '' : '✓'}
            </span>
            <span className="font-mono text-[11px] text-muted">
              {String(i + 1).padStart(2, '0')}
            </span>
            {setting}
            {skipped ? <span className="ml-auto text-xs">skipped</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

export function Pain() {
  return (
    <section id="problem" aria-labelledby="problem-title" className="px-3 pt-28 sm:px-5 lg:pt-36">
      <div className="mx-auto max-w-[80rem]">
        <div data-reveal className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">
            {PAIN.eyebrow}
          </p>
          <h2
            id="problem-title"
            className="mt-5 text-[2.25rem] leading-[1.04] font-semibold tracking-[-0.04em] text-balance text-ink sm:text-5xl lg:text-[3.5rem] lg:leading-[1.02]"
          >
            {PAIN.title}
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted">{PAIN.lead}</p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-3 lg:mt-16 lg:grid-cols-12">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-8" data-reveal-group>
            <PainCard {...retrieval}>
              <RetrievalSteps />
            </PainCard>
            <PainCard {...handoff}>
              <LeakedMessage />
            </PainCard>
            <PainCard {...links} className="sm:col-span-2">
              <LinkSettings />
            </PainCard>
          </div>
          <aside
            data-reveal
            aria-label={PAIN.statementEyebrow}
            className="statement-card panel flex flex-col justify-between gap-12 p-7 sm:p-9 lg:col-span-4"
          >
            <div>
              <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">
                {PAIN.statementEyebrow}
              </p>
              <p className="mt-5 text-[1.625rem] leading-[1.15] font-semibold tracking-[-0.03em] text-balance text-ink lg:text-[1.875rem]">
                {PAIN.statement}
              </p>
            </div>
            <Timeline />
          </aside>
        </div>
      </div>
    </section>
  );
}
