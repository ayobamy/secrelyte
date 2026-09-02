import { SiteHeader } from '@/components/site-header';
import { SignupForm } from '@/components/auth-forms';

export default function SignupPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader variant="app" />
      <main id="content" className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
        <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">New vault</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Create an account</h1>
        <p className="mt-4 text-[17px] leading-7 text-muted">
          The password never leaves this browser. We store ciphertext and a derived login key.
        </p>
        <div className="mt-10">
          <SignupForm />
        </div>
      </main>
    </div>
  );
}
