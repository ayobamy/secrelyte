import '../../app.css';
import { AuthShell, Card, CardBody, CardFactBand } from '@/components/auth-shell';
import { PreviewButton } from '@/components/landing/preview-button';
import { StatusTag } from '@/components/landing/status-tag';
import { SiteHeader } from '@/components/site-header';
import { DEMO_KEY_NAME } from '@/lib/brand/landing-content';
import { shareLinkLabel } from '@/lib/share-label';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const MASK = '••••••••••••••••••';

/**
 * What a share link will look like to the person who receives it. Share links are Next, so this
 * is a labelled preview: the value is a mask, and the one control says plainly that it did nothing.
 */
export default async function ShareViewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <AuthShell
      header={<SiteHeader variant="app" current="share" />}
      eyebrow={
        <>
          One-time handoff
          <StatusTag status="next" />
        </>
      }
      title="Share"
      lead="Share links are Next. This is the page a recipient will see: one value, a countdown, and a plain note about who can read it."
    >
      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 sm:px-7">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-base font-mono text-[11px] font-semibold text-ink"
            >
              S
            </span>
            <p className="truncate text-sm font-semibold tracking-tight text-ink">Stripe</p>
            <span className="pill">production</span>
          </div>
          <p className="shrink-0 font-mono text-[11px] text-muted">{shareLinkLabel(token)}</p>
        </div>
        <CardBody className="space-y-5">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs text-muted">Expires in</p>
              <p className="font-mono text-sm text-signal-ink tabular-nums">1h 59m</p>
            </div>
            <div aria-hidden className="expiry-bar mt-2">
              <span />
            </div>
          </div>
          <div className="value-box px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate font-mono text-[12.5px] font-medium text-ink">
                {DEMO_KEY_NAME}
              </p>
              <p className="font-mono text-[11px] text-muted">v3</p>
            </div>
            <p className="mt-2 font-mono text-[15px] tracking-[0.16em]">
              <span className="sr-only">Masked</span>
              <span aria-hidden className="sealed-dots">
                {MASK}
              </span>
            </p>
          </div>
          <p className="text-sm leading-6 text-muted">
            Anyone who controls this inbox can read it. Revoking cannot un-see a viewed key. Rotate
            it.
          </p>
          <PreviewButton
            label="Reveal once"
            hint="Opens one time. Then the link is spent."
            response="Preview only. Share links are Next, so nothing was revealed."
          />
        </CardBody>
        <CardFactBand aside="Preview only">No third-party scripts on this page</CardFactBand>
      </Card>
    </AuthShell>
  );
}
