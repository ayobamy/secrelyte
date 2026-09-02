import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line px-6 py-10 text-sm text-muted">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-md leading-6">
          We cannot read your secrets. If you lose the password and the recovery kit, the data is
          gone. That is the product, not a disclaimer.
        </p>
        <p>
          <Link href="/vault" className="text-ink underline-offset-4 hover:underline">
            Vault
          </Link>
          <span aria-hidden className="px-2 text-line">
            /
          </span>
          <Link href="/s/preview" className="text-ink underline-offset-4 hover:underline">
            Share
          </Link>
        </p>
      </div>
    </footer>
  );
}
