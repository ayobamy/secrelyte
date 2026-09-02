export const BRAND_SWATCHES = {
  base: '#FCFCFD',
  paper: '#FFFFFF',
  ink: '#0E1116',
  muted: '#6B7280',
  signal: '#F5B32E',
  signalInk: '#8A5A00',
  sealed: '#1F9D6B',
  sealedInk: '#0F6B48',
  exposed: '#E5484D',
  exposedInk: '#B42318',
} as const;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = channel(parseInt(h.slice(0, 2), 16));
  const g = channel(parseInt(h.slice(2, 4), 16));
  const b = channel(parseInt(h.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}
