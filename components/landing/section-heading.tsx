import type { ReactNode } from 'react';
import type { Status } from '@/lib/brand/landing-content';
import { StatusTag } from '@/components/landing/status-tag';

type SectionHeadingProps = {
  id: string;
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  status?: Status;
  align?: 'center' | 'start';
};

/** One heading shape for every section: eyebrow, a tightly tracked h2, an optional lead. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
  status,
  align = 'center',
}: SectionHeadingProps) {
  const centered = align === 'center';
  return (
    <div data-reveal className={centered ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl'}>
      <p
        className={`flex items-center gap-2.5 text-xs font-medium tracking-[0.2em] text-muted uppercase ${centered ? 'justify-center' : ''}`}
      >
        {eyebrow}
        {status ? <StatusTag status={status} /> : null}
      </p>
      <h2
        id={id}
        className="mt-5 text-[2.25rem] leading-[1.04] font-semibold tracking-[-0.04em] text-balance text-ink sm:text-5xl lg:text-[3.5rem] lg:leading-[1.02]"
      >
        {title}
      </h2>
      {lead ? (
        <p
          className={`mt-6 text-lg leading-8 text-pretty text-muted ${centered ? 'mx-auto max-w-2xl' : 'max-w-xl'}`}
        >
          {lead}
        </p>
      ) : null}
    </div>
  );
}
