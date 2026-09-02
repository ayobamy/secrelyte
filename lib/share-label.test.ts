import { describe, expect, it } from 'vitest';
import { shareLinkLabel } from './share-label';

describe('shareLinkLabel', () => {
  it('keeps the demo slug intact', () => {
    expect(shareLinkLabel('preview')).toBe('Demo link');
  });

  it('does not emit the broken "previe" fragment', () => {
    expect(shareLinkLabel('preview')).not.toMatch(/previe/i);
  });

  it('shortens a long token to six characters plus an ellipsis', () => {
    expect(shareLinkLabel('abcdef123456')).toBe('Link abcdef…');
  });

  it('shows a short token in full', () => {
    expect(shareLinkLabel('ab12')).toBe('Link ab12');
  });
});
