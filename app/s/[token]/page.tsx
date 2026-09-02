import { SiteHeader } from '@/components/site-header';
import { shareLinkLabel } from '@/lib/share-label';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function ShareViewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader variant="app" current="share" />
      <main id="content" className="mx-auto w-full max-w-lg flex-1 px-6 pt-16 pb-20">
        <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">
          One-time handoff
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Share</h1>
        <p className="mt-3 text-muted leading-7">
          Anyone who controls this inbox can read these. The fragment key never goes to the server.
          This page loads no third-party scripts.
        </p>

        <div className="mt-10 rounded-[2rem] border border-line bg-line/40 p-1.5 shadow-[0_20px_50px_rgba(14,17,22,0.04)]">
          <div className="rounded-[calc(2rem-0.375rem)] border border-line bg-paper px-5 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-muted">{shareLinkLabel(token)}</p>
                <p className="mt-1 font-medium text-ink">Stripe · production</p>
              </div>
              <p className="font-mono text-sm text-signal-ink">1h 59m</p>
            </div>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className="h-full w-[99%] rounded-full bg-signal" />
            </div>
            <div className="mt-6 rounded-2xl border border-line px-4 py-4">
              <p className="text-xs text-sealed-ink">Masked · sealed</p>
              <p className="mt-2 font-mono text-sm tracking-[0.18em] text-sealed-ink">
                ••••••••••••••••
              </p>
            </div>
            <p className="mt-5 text-sm leading-6 text-muted">
              Revoking cannot un-see a viewed key. Rotate it.
            </p>
            <button
              type="button"
              disabled
              className="mt-6 w-full rounded-full px-4 py-3 text-sm text-muted ring-1 ring-line"
            >
              Send a proof to this inbox
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
