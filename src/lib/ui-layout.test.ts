import { describe, expect, it } from 'vitest';

import { REVIEW_SECTIONS, resolveReaderLayoutMode } from './ui-layout';

describe('resolveReaderLayoutMode', () => {
  it('returns mobile for narrow widths', () => {
    expect(resolveReaderLayoutMode(767)).toBe('mobile');
  });

  it('returns desktop for wider widths', () => {
    expect(resolveReaderLayoutMode(1024)).toBe('desktop');
  });
});

describe('REVIEW_SECTIONS', () => {
  it('keeps the authoring tabs in the intended order', () => {
    expect(REVIEW_SECTIONS.map((section) => section.id)).toEqual([
      'canon',
      'characters',
      'worldbook',
      'rules'
    ]);
  });
});
