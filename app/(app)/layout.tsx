import type { ReactNode } from 'react';
import '../app.css';

/** The sign-in screens and the vault share the app stylesheet; the landing page does not load it. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return children;
}
