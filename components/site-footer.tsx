import Link from 'next/link';
import { Mark } from '@/components/mark';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '/#how', label: 'How it works' },
      { href: '/#guarantee', label: 'Security' },
      { href: '/#evidence', label: 'Evidence' },
      { href: '/#faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Vault',
    links: [
      { href: '/signup', label: 'Create a vault' },
      { href: '/login', label: 'Unlock' },
      { href: '/vault', label: 'Open vault' },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto px-3 pb-3 sm:px-5 sm:pb-5">
      <div className="mx-auto max-w-[80rem] rounded-[2rem] border border-line bg-paper px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="flex items-center gap-2 text-ink">
              <Mark size={22} title="" />
              <span className="text-[15px] font-semibold tracking-tight">Secrelyte</span>
            </p>
            <p className="mt-6 max-w-xl text-3xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance text-ink sm:text-4xl">
              Your secrets, in the light.
            </p>
            <p className="mt-5 max-w-md text-sm leading-6 text-muted">
              We cannot read your secrets. If you lose the password and the recovery kit, the data
              is gone. That is the product, not a disclaimer.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 lg:col-span-5">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
                  {column.title}
                </p>
                <ul className="mt-4 space-y-2.5 text-[15px]">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-ink underline-offset-4 hover:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
