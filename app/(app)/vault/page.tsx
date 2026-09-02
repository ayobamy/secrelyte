import { SiteHeader } from '@/components/site-header';
import { VaultComposer } from '@/components/vault-composer';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default function VaultPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader variant="app" current="vault" />
      <main id="content" className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6">
        <div className="flex flex-1 flex-col pt-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">
                This device
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">Vault</h1>
            </div>
            <p className="font-mono text-[11px] text-sealed-ink">encrypted · local</p>
          </div>
          <div className="flex flex-1 flex-col justify-center py-16">
            <p className="max-w-md text-[17px] leading-7 text-muted">
              Empty. Paste a messy block. Ciphertext only leaves the browser. Nothing is stored
              until you unlock.
            </p>
          </div>
        </div>
        <div className="sticky bottom-0 z-10 bg-gradient-to-t from-base from-60% to-transparent pb-6 pt-8">
          <VaultComposer />
        </div>
      </main>
    </div>
  );
}
