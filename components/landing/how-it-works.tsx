import type { ReactNode } from 'react';
import { HOW, type HowStep } from '@/lib/brand/landing-content';
import { StatusTag } from '@/components/landing/status-tag';
import { StepTabs } from '@/components/landing/step-tabs';
import {
  PickFragment,
  RevealFragment,
  SendFragment,
  WatchFragment,
} from '@/components/landing/how-fragments';

const FRAGMENTS: Record<HowStep['id'], () => ReactNode> = {
  pick: PickFragment,
  reveal: RevealFragment,
  send: SendFragment,
  watch: WatchFragment,
};

function MiniFlow({ current }: { current: number }) {
  return (
    <ol className="mini-flow flex min-w-0 items-center" aria-label="Where this step sits">
      {HOW.steps.map((step, i) => (
        <li
          key={step.id}
          data-state={step.status}
          data-current={i === current ? 'true' : 'false'}
          aria-current={i === current ? 'step' : undefined}
          className="flex min-w-0 flex-1 items-center text-muted first:flex-none"
        >
          <span className="flex items-center gap-1.5 sm:gap-2">
            <span aria-hidden className="mini-dot shrink-0" />
            <span className="text-[11px] font-medium sm:text-xs">{step.name}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function StepPanel({ step, index }: { step: HowStep; index: number }) {
  const Fragment = FRAGMENTS[step.id];
  return (
    <div className="flex h-full min-w-0 flex-col p-5 sm:p-8 lg:p-10">
      <MiniFlow current={index} />
      <div className="flex flex-1 flex-col justify-center">
        <div className="mx-auto mt-8 w-full max-w-md min-w-0">
          <Fragment />
        </div>
        <div className="mt-8 border-t border-line pt-6">
          <p className="flex items-center gap-3">
            <span className="font-mono text-sm text-signal-ink">{step.n}.</span>
            <StatusTag status={step.status} />
          </p>
          <h3 className="mt-3 text-2xl leading-tight font-semibold tracking-[-0.03em] text-balance text-ink sm:text-[1.75rem]">
            {step.title}
          </h3>
          <p className="mt-2 max-w-xl text-[15px] leading-7 text-muted">{step.body}</p>
        </div>
      </div>
    </div>
  );
}

export function HowItWorks() {
  const intro = (
    <div>
      <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">{HOW.eyebrow}</p>
      <h2
        id="how-title"
        className="mt-5 text-[2.25rem] leading-[1.04] font-semibold tracking-[-0.04em] text-balance text-ink sm:text-5xl lg:text-[3.25rem]"
      >
        {HOW.title}
      </h2>
      <p className="mt-5 max-w-md text-[17px] leading-7 text-muted">{HOW.lead}</p>
    </div>
  );
  return (
    <section id="how" aria-labelledby="how-title" className="px-3 pt-28 sm:px-5 lg:pt-36">
      <div className="mx-auto max-w-[80rem]">
        <StepTabs
          steps={HOW.steps}
          intro={intro}
          panels={HOW.steps.map((step, i) => (
            <StepPanel key={step.id} step={step} index={i} />
          ))}
        />
      </div>
    </section>
  );
}
