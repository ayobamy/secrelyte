import { AuthShell } from '@/components/auth-shell';
import { LoginForm } from '@/components/auth-forms';
import { SiteHeader } from '@/components/site-header';

export default function LoginPage() {
  return (
    <AuthShell
      header={<SiteHeader variant="auth" authLink={{ href: '/signup', label: 'Create a vault' }} />}
      eyebrow="This device"
      title="Unlock"
      lead="Your password opens the vault here, in this browser. The server only ever sees a key derived from it."
    >
      <LoginForm />
    </AuthShell>
  );
}
