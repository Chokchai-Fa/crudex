import { describe, expect, it } from 'vitest';
import { indicatorsM2, topicsM2 } from '../src/data/indicators-m2';

describe('ม.2 mathematics curriculum', () => {
  const indicatorIds = new Set(indicatorsM2.map(({ id }) => id));

  it('has all indicators with unique IDs', () => {
    // The PDF lists 12 indicators on printed pages 13, 15, 23, 26, and 29.
    expect(indicatorsM2).toHaveLength(12);
    expect(indicatorIds.size).toBe(indicatorsM2.length);
  });

  it('uses the ม.2 grade for every indicator', () => {
    for (const { id, grade } of indicatorsM2) {
      expect(grade, id).toBe('ม.2');
    }
  });

  it('contains no private-use glyphs or replacement characters in curriculum text', () => {
    const brokenGlyph = /[\uF700-\uF8FF\uFFFD]/u;

    for (const { id, text } of indicatorsM2) {
      expect(text, id).not.toMatch(brokenGlyph);
    }
    for (const { name, indicator } of topicsM2) {
      expect(name, indicator).not.toMatch(brokenGlyph);
    }
  });

  it('links each curriculum bullet to an existing indicator', () => {
    expect(topicsM2).toHaveLength(34);
    for (const { name, indicator } of topicsM2) {
      expect(indicatorIds.has(indicator), name).toBe(true);
    }
  });
});
