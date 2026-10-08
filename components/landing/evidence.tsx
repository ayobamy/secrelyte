import type { ReactNode } from 'react';
import { EVIDENCE } from '@/lib/brand/landing-content';
import { SectionHeading } from '@/components/landing/section-heading';

const [e2e, rls, crypto, csp] = EVIDENCE.cards;

function Pass({ children }: { children: string }) {
  return (
    <span className="flex gap-2.5">
      <span aria-hidden className="text-sealed-ink">
        ✓
      </span>
      <span>{children}</span>
    </span>
  );
}

function EgressLog() {
  return (
    <pre className="code-block p-4 whitespace-pre-wrap text-ink">
      <code className="grid gap-0.5">
        <Pass>sign up in a real browser</Pass>
        <Pass>store a secret</Pass>
        <Pass>reveal it</Pass>
        <Pass>outgoing requests checked for the plaintext</Pass>
      </code>
    </pre>
  );
}

function RlsSnippet() {
  return (
    <pre className="code-block overflow-x-auto p-4 text-ink">
      <code>
        {'ALTER TABLE public.secrets\n  FORCE ROW LEVEL SECURITY;\n'}
        <span className="text-muted">
          {'\n-- CI queries as a second, real user,\n-- never with the service key.'}
        </span>
      </code>
    </pre>
  );
}

function CoverageMeter() {
  return (
    <div className="code-block space-y-4 p-4">
      <div>
        <p className="flex items-center justify-between text-ink">
          <span>branches</span>
          <span className="text-sealed-ink">100%</span>
        </p>
        <div aria-hidden className="meter mt-2">
          <span />
        </div>
      </div>
      <p className="flex items-center justify-between border-t border-line pt-3 text-ink">
        <span>test vectors</span>
        <span className="text-muted">frozen</span>
      </p>
    </div>
  );
}

function CspSnippet() {
  return (
    <pre className="code-block overflow-x-auto p-4 text-ink">
      <code>
        <span className="text-muted">{'# vault pages\n'}</span>
        {"default-src 'none';\n"}
        {"script-src 'self' 'nonce-…'\n  'strict-dynamic' 'wasm-unsafe-eval';\n"}
        {"frame-ancestors 'none';"}
      </code>
    </pre>
  );
}

function EvidenceCard({
  card,
  children,
}: {
  card: (typeof EVIDENCE.cards)[number];
  children: ReactNode;
}) {
  return (
    <article data-reveal className="panel flex flex-col p-6 sm:p-8">
      <h3 className="text-xl leading-snug font-semibold tracking-[-0.02em] text-balance text-ink">
        {card.title}
      </h3>
      <p className="mt-2 text-[15px] leading-6 text-muted">{card.body}</p>
      <div className="mt-6 flex-1">{children}</div>
      <p className="mt-6 border-t border-line pt-4 font-mono text-[10.5px] font-medium tracking-[0.16em] text-muted uppercase">
        {card.tag}
      </p>
    </article>
  );
}

export function Evidence() {
  return (
    <section id="evidence" aria-labelledby="evidence-title" className="px-3 pt-28 sm:px-5 lg:pt-36">
      <div className="mx-auto max-w-[80rem]">
        <SectionHeading
          id="evidence-title"
          eyebrow={EVIDENCE.eyebrow}
          title={EVIDENCE.title}
          lead={EVIDENCE.lead}
        />
        <div className="mt-14 grid grid-cols-1 gap-3 md:grid-cols-2 lg:mt-16" data-reveal-group>
          <EvidenceCard card={e2e}>
            <EgressLog />
          </EvidenceCard>
          <EvidenceCard card={rls}>
            <RlsSnippet />
          </EvidenceCard>
          <EvidenceCard card={crypto}>
            <CoverageMeter />
          </EvidenceCard>
          <EvidenceCard card={csp}>
            <CspSnippet />
          </EvidenceCard>
        </div>
      </div>
    </section>
  );
}
