'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export function HeroStage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches) {
      return;
    }
    const node = el;
    function onMove(event: PointerEvent) {
      const box = node.getBoundingClientRect();
      node.style.setProperty('--mx', `${event.clientX - box.left}px`);
      node.style.setProperty('--my', `${event.clientY - box.top}px`);
    }
    node.addEventListener('pointermove', onMove, { passive: true });
    return () => node.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <section
      ref={ref}
      className="hero-stage relative mx-auto grid max-w-6xl items-center gap-14 px-6 pt-16 pb-24 lg:min-h-[calc(100dvh-5.5rem)] lg:grid-cols-12 lg:gap-12 lg:pt-20 lg:pb-28"
    >
      <div className="hero-orb" aria-hidden />
      {children}
    </section>
  );
}
