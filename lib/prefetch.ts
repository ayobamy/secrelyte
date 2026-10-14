'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

type Router = ReturnType<typeof useRouter>;
type PrefetchOptions = Parameters<Router['prefetch']>[1];

/**
 * Fetches `href` in full ahead of a navigation the user is about to make. Every route here is
 * rendered per request (the CSP nonce), and Next's default prefetch fetches nothing for such a
 * route, so the click would wait on a full server round trip. The 'full' kind is Next's own
 * PrefetchKind value; its enum is not exported from a public entry point.
 */
export function prefetchFull(router: Router, href: string): void {
  router.prefetch(href, { kind: 'full' } as unknown as PrefetchOptions);
}

/** Prefetches `href` in full once the component has mounted. */
export function usePrefetchFull(href: string): void {
  const router = useRouter();
  useEffect(() => {
    prefetchFull(router, href);
  }, [router, href]);
}
