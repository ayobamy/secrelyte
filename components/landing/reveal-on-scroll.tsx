'use client';

import { useEffect } from 'react';

/**
 * Fades [data-reveal] elements in as they enter the viewport. Order matters: anything already
 * in view is marked shown before .motion-ready is added to <html>, so nothing on screen ever
 * blinks out. With reduced motion, or before this runs, nothing is hidden at all. Only
 * attributes and classes change, never inline styles, so it is CSP-safe.
 */
export function RevealOnScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const root = document.documentElement;
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const pending: HTMLElement[] = [];
    for (const el of targets) {
      if (el.getBoundingClientRect().top < window.innerHeight) {
        el.dataset.shown = '';
      } else {
        pending.push(el);
      }
    }
    root.classList.add('motion-ready');

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.shown = '';
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    for (const el of pending) {
      observer.observe(el);
    }
    return () => {
      observer.disconnect();
      root.classList.remove('motion-ready');
    };
  }, []);

  return null;
}
