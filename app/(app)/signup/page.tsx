import { AuthShell } from '@/components/auth-shell';
import { SignupForm } from '@/components/auth-forms';
import { SiteHeader } from '@/components/site-header';

export default function SignupPage() {
  return (
    <AuthShell
      header={<SiteHeader variant="auth" authLink={{ href: '/login', label: 'Unlock' }} />}
      eyebrow="New vault"
      title="Create an account"
      lead="One password derives every key, in this browser. We store ciphertext we cannot open."
    >
      <SignupForm />
    </AuthShell>
  );
}
