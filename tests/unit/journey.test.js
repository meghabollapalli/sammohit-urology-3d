import { describe, expect, it } from 'vitest';
import { journeyFromRanges } from '../../src/lib/journey.js';

// hero at 0, then three chapters; the middle one is taller than the screen.
const ranges = [
  [0, 0],
  [1000, 1000],
  [2000, 2600],
  [3600, 3600]
];

describe('journeyFromRanges', () => {
  it('is 0 at the top and 3 past the last chapter', () => {
    expect(journeyFromRanges(ranges, 0)).toBe(0);
    expect(journeyFromRanges(ranges, 9999)).toBe(3);
  });

  it('sits on a whole number while a chapter is centred', () => {
    expect(journeyFromRanges(ranges, 1000)).toBe(1);
    expect(journeyFromRanges(ranges, 2000)).toBe(2);
    expect(journeyFromRanges(ranges, 2300)).toBe(2);
    expect(journeyFromRanges(ranges, 2600)).toBe(2);
  });

  it('moves evenly and never backwards between chapters', () => {
    expect(journeyFromRanges(ranges, 500)).toBeCloseTo(0.5);
    expect(journeyFromRanges(ranges, 3100)).toBeCloseTo(2.5);
    let last = -1;
    for (let y = 0; y <= 4000; y += 25) {
      const j = journeyFromRanges(ranges, y);
      expect(j).toBeGreaterThanOrEqual(last);
      expect(j - Math.max(0, last)).toBeLessThan(0.1);
      last = j;
    }
  });
});
