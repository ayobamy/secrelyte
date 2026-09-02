import { describe, expect, it } from 'vitest';
import { BRAND_SWATCHES, contrastRatio } from './contrast';

describe('brand text contrast', () => {
  it('keeps body and status inks at WCAG AA on the light base', () => {
    const { base, ink, muted, signalInk, sealedInk, exposedInk } = BRAND_SWATCHES;
    expect(contrastRatio(ink, base)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(muted, base)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(signalInk, base)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(sealedInk, base)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(exposedInk, base)).toBeGreaterThanOrEqual(4.5);
  });

  it('forbids using fill accents as text on white', () => {
    const { paper, signal, sealed, exposed } = BRAND_SWATCHES;
    expect(contrastRatio(signal, paper)).toBeLessThan(4.5);
    expect(contrastRatio(sealed, paper)).toBeLessThan(4.5);
    expect(contrastRatio(exposed, paper)).toBeLessThan(4.5);
  });
});
