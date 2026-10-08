'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { HowStep } from '@/lib/brand/landing-content';
import { StatusTag } from '@/components/landing/status-tag';

type StepTabsProps = {
  steps: readonly HowStep[];
  panels: readonly ReactNode[];
  intro: ReactNode;
};

/**
 * WAI-ARIA tabs with automatic activation (panels are static and cheap to show), a roving
 * tabindex, and arrow, Home and End keys. Panels are rendered on the server and only toggled
 * here, so the content is in the HTML before any JS runs. Panels hold no focusable controls,
 * so each panel takes focus itself, per the APG tabs pattern.
 *
 * All panels share one grid cell (.tab-stack), so the box is always as tall as the tallest
 * panel and switching never moves the page. Inactive panels are visibility:hidden, which also
 * takes them out of the accessibility tree and the tab order, as the hidden attribute would.
 */
export function StepTabs({ steps, panels, intro }: StepTabsProps) {
  const [active, setActive] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  function select(index: number) {
    const next = (index + steps.length) % steps.length;
    setActive(next);
    tabs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowRight: index + 1,
      ArrowUp: index - 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: steps.length - 1,
    };
    const target = keys[event.key];
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    select(target);
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      <div data-reveal className="panel flex flex-col p-6 sm:p-8 lg:col-span-5 lg:p-10">
        {intro}
        <div
          role="tablist"
          aria-label="How it works, step by step"
          aria-orientation="vertical"
          className="mt-10 border-t border-line lg:mt-auto"
        >
          {steps.map((step, i) => {
            const selected = i === active;
            return (
              <button
                key={step.id}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`how-tab-${step.id}`}
                aria-selected={selected}
                aria-controls={`how-panel-${step.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(i)}
                onKeyDown={(event) => onKeyDown(event, i)}
                className="step-tab relative block w-full border-b border-line py-5 text-left"
              >
                <span className="flex items-center gap-4">
                  <span className="step-n font-mono text-sm text-muted">{step.n}.</span>
                  <span className="step-name text-xl font-medium tracking-[-0.02em] text-muted">
                    {step.name}
                  </span>
                  <StatusTag status={step.status} className="ml-auto" />
                </span>
                <span className="mt-1 block pl-[2.55rem] text-sm text-muted">{step.summary}</span>
                <span
                  aria-hidden
                  className="step-bar absolute -bottom-px left-0 h-0.5 w-full rounded-full bg-signal"
                />
              </button>
            );
          })}
        </div>
      </div>

      <div data-reveal className="panel flex min-w-0 flex-col overflow-hidden lg:col-span-7">
        <div className="tab-stack flex-1">
          {steps.map((step, i) => (
            <div
              key={step.id}
              role="tabpanel"
              id={`how-panel-${step.id}`}
              aria-labelledby={`how-tab-${step.id}`}
              data-active={i === active}
              tabIndex={0}
              className="rounded-[2rem] focus-visible:outline-offset-[-6px]"
            >
              {panels[i]}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-8 lg:px-10">
          <p className="font-mono text-xs text-muted">
            Step {steps[active].n} of {String(steps.length).padStart(2, '0')}
          </p>
          <button
            type="button"
            onClick={() => setActive((active + 1) % steps.length)}
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm text-ink ring-1 ring-line transition-colors duration-300 hover:bg-base"
          >
            {active === steps.length - 1
              ? `Back to ${steps[0].name}`
              : `Continue to ${steps[active + 1].name}`}
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
