import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  clampValue,
  DETENTS,
  nextDetent,
  nextStop,
  prevDetent,
  prevStop,
  RANGE_MAX,
  RANGE_MIN,
  ratioToValue,
  SEGMENT_COUNT,
  SEGMENTS,
  snap,
  stepAt,
  valueToRatio,
} from '@/components/rangeScale';

/** Every valid fine-step stop across the whole scale (detents deduplicated). */
function allStops(): number[] {
  const stops = new Set<number>();
  for (const seg of SEGMENTS) {
    for (let v = seg.lo; v <= seg.hi; v += seg.step) stops.add(v);
  }
  return [...stops].sort((a, b) => a - b);
}

describe('rangeScale detents & segments', () => {
  it('exposes seven detents and six equal segments', () => {
    expect(DETENTS).toEqual([0, 10, 100, 1_000, 10_000, 100_000, 1_000_000]);
    expect(SEGMENT_COUNT).toBe(6);
    expect(SEGMENTS).toHaveLength(6);
  });

  it('places detents at equal visual spacing (i / 6)', () => {
    DETENTS.forEach((detent, i) => {
      expect(valueToRatio(detent)).toBeCloseTo(i / SEGMENT_COUNT, 10);
    });
    expect(valueToRatio(RANGE_MIN)).toBe(0);
    expect(valueToRatio(RANGE_MAX)).toBe(1);
  });

  it('each segment spans an integer number of fine steps', () => {
    for (const seg of SEGMENTS) {
      expect(Number.isInteger((seg.hi - seg.lo) / seg.step)).toBe(true);
    }
  });
});

describe('valueToRatio / ratioToValue inverse', () => {
  const stops = allStops();

  it('round-trips exactly (after snap) on every valid stop', () => {
    for (const v of stops) {
      expect(snap(v)).toBe(v);
      expect(snap(ratioToValue(valueToRatio(v)))).toBe(v);
    }
  });

  it('round-trips within float epsilon before snapping', () => {
    for (const v of stops) {
      expect(ratioToValue(valueToRatio(v))).toBeCloseTo(v, 3);
    }
  });

  it('ratios increase monotonically with value', () => {
    for (let i = 1; i < stops.length; i += 1) {
      const prev = stops[i - 1];
      const curr = stops[i];
      if (prev === undefined || curr === undefined) throw new Error('bad fixture');
      expect(valueToRatio(curr)).toBeGreaterThan(valueToRatio(prev));
    }
  });

  it('is inverse for random ratios (ratio -> value -> ratio)', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (r) => {
        expect(valueToRatio(ratioToValue(r))).toBeCloseTo(r, 9);
      }),
    );
  });

  it('clamps ratios and values outside the domain', () => {
    expect(ratioToValue(-1)).toBe(RANGE_MIN);
    expect(ratioToValue(2)).toBe(RANGE_MAX);
    expect(valueToRatio(-500)).toBe(0);
    expect(valueToRatio(9_999_999)).toBe(1);
    expect(clampValue(Number.NaN)).toBe(RANGE_MIN);
  });
});

describe('snap correctness at segment boundaries', () => {
  it('snaps to the nearest fine step within the containing segment', () => {
    expect(snap(9.6)).toBe(10);
    expect(snap(10.4)).toBe(10);
    expect(snap(12)).toBe(10);
    expect(snap(13)).toBe(15);
    expect(snap(99)).toBe(100);
    expect(snap(101)).toBe(100);
    expect(snap(124)).toBe(100);
    expect(snap(126)).toBe(150);
    expect(snap(1_249)).toBe(1_000);
    expect(snap(1_251)).toBe(1_500);
  });

  it('leaves detents and exact stops untouched and clamps ends', () => {
    for (const detent of DETENTS) expect(snap(detent)).toBe(detent);
    expect(snap(-9)).toBe(RANGE_MIN);
    expect(snap(2_000_000)).toBe(RANGE_MAX);
  });

  it('reports the fine step that applies when stepping up', () => {
    expect(stepAt(0)).toBe(1);
    expect(stepAt(5)).toBe(1);
    expect(stepAt(10)).toBe(5);
    expect(stepAt(100)).toBe(50);
    expect(stepAt(100_000)).toBe(50_000);
  });
});

describe('directional stepping (arrows)', () => {
  it('nextStop returns the smallest valid stop above a value', () => {
    expect(nextStop(0)).toBe(1);
    expect(nextStop(9)).toBe(10);
    expect(nextStop(10)).toBe(15); // steps up into the coarser decade
    expect(nextStop(95)).toBe(100);
    expect(nextStop(100)).toBe(150);
    expect(nextStop(100_000)).toBe(150_000);
    expect(nextStop(RANGE_MAX)).toBe(RANGE_MAX);
  });

  it('prevStop returns the largest valid stop below a value', () => {
    expect(prevStop(RANGE_MIN)).toBe(RANGE_MIN);
    expect(prevStop(10)).toBe(9); // steps down into the finer decade
    expect(prevStop(15)).toBe(10);
    expect(prevStop(100)).toBe(95);
    expect(prevStop(150)).toBe(100);
    expect(prevStop(RANGE_MAX)).toBe(950_000);
  });

  it('nextStop and prevStop are inverse across a detent', () => {
    for (const detent of DETENTS) {
      if (detent < RANGE_MAX) expect(prevStop(nextStop(detent))).toBe(detent);
      if (detent > RANGE_MIN) expect(nextStop(prevStop(detent))).toBe(detent);
    }
  });
});

describe('detent jumps (PageUp / PageDown)', () => {
  it('nextDetent returns the next detent above a value', () => {
    expect(nextDetent(0)).toBe(10);
    expect(nextDetent(5)).toBe(10);
    expect(nextDetent(10)).toBe(100);
    expect(nextDetent(999_999)).toBe(RANGE_MAX);
    expect(nextDetent(RANGE_MAX)).toBe(RANGE_MAX);
  });

  it('prevDetent returns the next detent below a value', () => {
    expect(prevDetent(RANGE_MAX)).toBe(100_000);
    expect(prevDetent(10)).toBe(0);
    expect(prevDetent(5)).toBe(0);
    expect(prevDetent(RANGE_MIN)).toBe(RANGE_MIN);
  });
});
