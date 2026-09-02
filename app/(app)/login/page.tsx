import { SiteHeader } from '@/components/site-header';
import { LoginForm } from '@/components/auth-forms';

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader variant="app" />
      <main id="content" className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
        <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">This device</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Unlock</h1>
        <p className="mt-4 text-[17px] leading-7 text-muted">
          Wrong password fails when the wrap does not open. The server is not the judge.
        </p>
        <div className="mt-10">
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
