import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine';

function sequence(seed: string | number, count: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng.next());
}

describe('createRng determinism', () => {
  it('produces the same sequence for the same string seed', () => {
    expect(sequence('wordavi', 20)).toEqual(sequence('wordavi', 20));
  });
  it('produces the same sequence for the same numeric seed', () => {
    expect(sequence(42, 20)).toEqual(sequence(42, 20));
  });
  it('produces different sequences for different seeds', () => {
    expect(sequence('a', 20)).not.toEqual(sequence('b', 20));
  });
});

describe('rng.next', () => {
  it('stays in [0, 1)', () => {
    const rng = createRng('range');
    for (let i = 0; i < 1000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('rng.int', () => {
  it('stays within the inclusive bounds', () => {
    const rng = createRng('int');
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const value = rng.int(3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
      seen.add(value);
    }
    expect(seen).toEqual(new Set([3, 4, 5, 6, 7]));
  });
  it('returns the single value when lo === hi', () => {
    expect(createRng('x').int(5, 5)).toBe(5);
  });
});

describe('rng.pick', () => {
  it('returns an element of the array', () => {
    const rng = createRng('pick');
    const arr = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i++) expect(arr).toContain(rng.pick(arr));
  });
  it('throws a RangeError on an empty array', () => {
    expect(() => createRng('e').pick([])).toThrow(RangeError);
  });
});

describe('rng.weighted', () => {
  it('never returns a zero-weighted item and honours relative weights', () => {
    const rng = createRng('weighted');
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 4000; i++) {
      const key = rng.weighted<'a' | 'b' | 'c'>([
        ['a', 3],
        ['b', 1],
        ['c', 0],
      ]);
      counts[key]++;
    }
    expect(counts.c).toBe(0);
    // a (weight 3) should clearly outnumber b (weight 1).
    expect(counts.a).toBeGreaterThan(counts.b * 2);
  });

  it('throws a RangeError when no weight is positive', () => {
    expect(() =>
      createRng('zero').weighted([
        ['a', 0],
        ['b', 0],
      ]),
    ).toThrow(RangeError);
  });
});
