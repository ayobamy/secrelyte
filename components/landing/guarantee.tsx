import { DEMO_KEY_NAME, DEMO_SECRET, GUARANTEE } from '@/lib/brand/landing-content';
import { SectionHeading } from '@/components/landing/section-heading';

const CIPHER_ROWS = ['7c2e 91f4', '0ad8 b3e6', 'a91c 5f07', 'e2b3 4d61'] as const;

/**
 * The guarantee as the brand's own metaphor: your browser is lit, the server is dark. The lit
 * half holds every step that touches plaintext; only ciphertext and a login key cross the seam;
 * the dark half says what the server holds and what it can do with it.
 */
export function Guarantee() {
  const browser = GUARANTEE.steps.filter((step) => step.zone === 'browser');
  const server = GUARANTEE.steps.filter((step) => step.zone === 'server');
  return (
    <section
      id="guarantee"
      aria-labelledby="guarantee-title"
      className="px-3 pt-28 sm:px-5 lg:pt-36"
    >
      <div className="mx-auto max-w-[80rem]">
        <SectionHeading
          id="guarantee-title"
          eyebrow={GUARANTEE.eyebrow}
          title={GUARANTEE.title}
          lead={GUARANTEE.lead}
        />

        <figure
          data-reveal
          aria-labelledby="split-caption"
          className="split mt-14 grid grid-cols-1 overflow-hidden rounded-[2rem] border border-line lg:mt-16 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
        >
          <figcaption id="split-caption" className="sr-only">
            Your password, the encryption key and every plaintext value stay in your browser. The
            server receives a login key derived from your password, ciphertext, wrapped keys, and
            product and key names, which it stores readable. It holds no key that opens the
            ciphertext.
          </figcaption>

          <div className="split-lit relative grid grid-cols-1 gap-10 p-6 pb-14 sm:p-10 sm:pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8 lg:pr-10 lg:pb-10">
            <div aria-hidden className="split-lit-light" />
            <div className="min-w-0">
              <p className="zone-label">
                <span aria-hidden className="zone-dot zone-dot-lit" />
                {GUARANTEE.lit}
                <span className="text-muted">· {GUARANTEE.litNote}</span>
              </p>
              <ol className="flow-rail mt-7 space-y-4">
                {browser.map((step) => (
                  <li key={step.id} data-attn="true" data-zone="browser">
                    <p className="text-[15px] font-semibold text-ink">{step.title}</p>
                    <p className="mt-0.5 text-sm leading-5 text-muted">{step.detail}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex min-w-0 flex-col justify-center gap-6">
              <div className="lit-plain rounded-2xl px-4 py-3.5">
                <p className="font-mono text-[11px] text-muted">{DEMO_KEY_NAME}</p>
                <p className="mt-1 truncate font-mono text-[14px] text-ink" translate="no">
                  {DEMO_SECRET}
                </p>
                <p className="mt-2 text-xs text-muted">Plaintext, on this device only.</p>
              </div>
              <div aria-hidden className="relative flex items-center lg:-mr-10">
                <span className="lit-beam h-px flex-1" />
              </div>
              <p className="font-mono text-[11px] tracking-[0.08em] text-signal-ink">
                sealed before it leaves
              </p>
            </div>

            <div className="seam-chip">
              <span className="sr-only">Crossing to the server: </span>
              <span aria-hidden className="sealed-dot" />
              ciphertext
            </div>
          </div>

          <div className="split-dark relative flex flex-col gap-8 p-6 pt-14 sm:p-10 sm:pt-16 lg:pt-10 lg:pl-20">
            <div aria-hidden className="split-dark-grain" />
            <p className="zone-label text-paper">
              <span aria-hidden className="zone-dot zone-dot-dark" />
              {GUARANTEE.dark}
              <span className="text-paper/65">· {GUARANTEE.darkNote}</span>
            </p>

            <div>
              <p className="text-[13px] text-paper/65">{GUARANTEE.holds}</p>
              {server.map((item) => (
                <div key={item.id} className="mt-3 rounded-2xl border border-paper/15 px-4 py-3.5">
                  <p className="text-[15px] font-medium text-paper">{item.title}</p>
                  <p className="mt-0.5 text-sm text-paper/65">{item.detail}</p>
                  <p className="dark-sealed mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[12px] sm:grid-cols-4">
                    {CIPHER_ROWS.map((row) => (
                      <span key={row}>{row}</span>
                    ))}
                  </p>
                </div>
              ))}
            </div>

            <div className="split-verdict">
              <p className="text-[13px] text-paper/65">{GUARANTEE.canDo}</p>
              <p className="mt-2 text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] text-paper sm:text-[2rem]">
                {GUARANTEE.verdict}
              </p>
              <p className="mt-3 text-sm text-paper/65">{GUARANTEE.alsoStored}</p>
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
}
