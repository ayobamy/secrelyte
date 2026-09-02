import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main id="content" className="mx-auto max-w-xl flex-1 px-6 pt-24">
        <h1 className="text-3xl font-semibold tracking-tight">Not found</h1>
        <p className="mt-3 text-muted leading-7">
          Absent, or you are not meant to know it exists. Same response either way.
        </p>
        <Link href="/" className="mt-8 inline-block text-ink underline-offset-4 hover:underline">
          Back to the light
        </Link>
      </main>
    </div>
  );
}
