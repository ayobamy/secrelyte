import Link from 'next/link';
import './app.css';
import { AuthShell } from '@/components/auth-shell';
import { SiteHeader } from '@/components/site-header';
import { ArrowDot, PRIMARY_BUTTON, QUIET_BUTTON } from '@/components/ui';

export default function NotFound() {
  return (
    <AuthShell
      header={<SiteHeader solid />}
      eyebrow="404"
      title="Not found"
      lead="Absent, or you are not meant to know it exists. Same response either way."
    >
      <div className="mx-auto max-w-[22rem] space-y-3">
        <Link prefetch href="/" className={PRIMARY_BUTTON}>
          Back to the home page
          <ArrowDot />
        </Link>
        <Link prefetch href="/vault" className={`${QUIET_BUTTON} w-full`}>
          Open your vault
        </Link>
      </div>
    </AuthShell>
  );
}
