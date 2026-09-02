import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Secrelyte',
  description: 'We cannot read your secrets. Ask for it. Send it. Watch it expire.',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>{nonce ? <meta property="csp-nonce" content={nonce} /> : null}</head>
      <body className="flex min-h-full flex-col bg-base text-ink">
        <div className="grain" aria-hidden />
        {children}
      </body>
    </html>
  );
}
