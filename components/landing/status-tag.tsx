import type { Status } from '@/lib/brand/landing-content';

/**
 * Live ships today. Next is designed and not shipped. Live is solid ink, Next is a dashed
 * outline, so the two read differently even in greyscale, and neither borrows the sealed or
 * exposed colours, which are reserved for state.
 */
export function StatusTag({ status, className = '' }: { status: Status; className?: string }) {
  return status === 'live' ? (
    <span className={`tag tag-live ${className}`}>Live</span>
  ) : (
    <span className={`tag tag-next ${className}`}>Next</span>
  );
}
