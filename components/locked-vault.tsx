import Link from 'next/link';
import type { ReactNode } from 'react';
import { AuthShell, Card, CardBody, CardFactBand, CardLinkBand } from '@/components/auth-shell';
import { SiteHeader } from '@/components/site-header';
import { ArrowDot, PRIMARY_BUTTON, TEXT_LINK } from '@/components/ui';

const MASK = '••••••••••••••••••';

/**
 * The vault with no keys in memory: the hero card in its sealed state, and one way forward. The
 * clipboard notice, when a lock just cleared (or could not clear) a copied secret, sits above.
 */
export function LockedVault({ notice }: { notice?: ReactNode }) {
  return (
    <AuthShell
      header={<SiteHeader variant="app" current="vault" />}
      eyebrow="This device"
      title="Vault"
      lead="Locked. Keys live in memory on this device only. Unlock to unwrap them; nothing is written to browser storage."
      notice={notice}
    >
      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 sm:px-7">
          <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Sealed</p>
          <p className="flex items-center gap-2 font-mono text-[11px] text-sealed-ink">
            <span aria-hidden className="sealed-dot" />
            encrypted
          </p>
        </div>
        <CardBody className="space-y-5">
          <div className="value-box px-4 py-3.5">
            <p className="text-xs text-muted">This device · locked</p>
            <p className="mt-2 font-mono text-[15px] tracking-[0.16em]">
              <span className="sr-only">Masked</span>
              <span aria-hidden className="sealed-dots">
                {MASK}
              </span>
            </p>
          </div>
          <p className="text-sm leading-6 text-muted">
            Ciphertext is on the server. The unwrap key is not.
          </p>
          <Link prefetch href="/login" className={PRIMARY_BUTTON}>
            Unlock
            <ArrowDot />
          </Link>
        </CardBody>
        <CardLinkBand>
          New here?{' '}
          <Link prefetch href="/signup" className={TEXT_LINK}>
            Create a vault
          </Link>
        </CardLinkBand>
        <CardFactBand aside="Locked">Decrypts only in this browser</CardFactBand>
      </Card>
    </AuthShell>
  );
}
