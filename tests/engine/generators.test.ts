import { describe, expect, it } from 'vitest';
import { createRng, generateNumber, generatePrice, generateQuantity } from '@/engine';

describe('generateNumber', () => {
  it('stays within range', () => {
    const rng = createRng('gn-range');
    for (let i = 0; i < 1000; i++) {
      const value = generateNumber(rng, { min: 10, max: 250 });
      expect(value).toBeGreaterThanOrEqual(10);
      expect(value).toBeLessThanOrEqual(250);
    }
  });

  it('returns min when min >= max', () => {
    expect(generateNumber(createRng('x'), { min: 7, max: 7 })).toBe(7);
  });

  it('balances digit lengths instead of letting big numbers dominate', () => {
    const rng = createRng('gn-balance');
    const draws = 4000;
    let single = 0;
    let sixPlus = 0;
    for (let i = 0; i < draws; i++) {
      const value = generateNumber(rng, { min: 0, max: 1_000_000 });
      if (value < 10) single++;
      if (value >= 100_000) sixPlus++;
    }
    // Uniform sampling of 0..1e6 would give <10 essentially never and 6+ digits
    // ~90% of the time. Band-balancing keeps both near 1/7.
    expect(single / draws).toBeGreaterThan(0.08);
    expect(sixPlus / draws).toBeLessThan(0.4);
  });
});

describe('generateNumber at the range slider detents', () => {
  // Every detent is a power of ten, so the top digit band collapses to the
  // single value `max`: exactly the case where a per-band draw over-samples it.
  const DETENTS = [10, 100, 1_000, 10_000, 100_000, 1_000_000] as const;
  const DRAWS = 50_000;

  function shareOf(target: number, range: { min: number; max: number }, seed: string): number {
    const rng = createRng(seed);
    let hits = 0;
    for (let i = 0; i < DRAWS; i++) {
      if (generateNumber(rng, range) === target) hits++;
    }
    return hits / DRAWS;
  }

  it('returns 0 for the collapsed 0..0 range', () => {
    expect(generateNumber(createRng('detent-zero'), { min: 0, max: 0 })).toBe(0);
  });

  it.each(DETENTS)('draws the exact max %i no oftener than a fair share', (max) => {
    const share = shareOf(max, { min: 0, max }, `detent-${max}`);
    // Ceiling is three times what uniform sampling of the whole range would
    // give that one value — generous, and still far under the quarter of all
    // draws a whole band's worth would be.
    expect(share).toBeLessThanOrEqual(3 / (max + 1));
  });

  it('draws the exact max no oftener than a fair share when min is a detent too', () => {
    const share = shareOf(10_000, { min: 1_000, max: 10_000 }, 'detent-span');
    expect(share).toBeLessThanOrEqual(3 / 9001);
  });

  it('keeps digit lengths balanced when the top band holds one value', () => {
    const rng = createRng('detent-balance');
    const draws = 9000;
    const byLength = new Map<number, number>();
    for (let i = 0; i < draws; i++) {
      const length = String(generateNumber(rng, { min: 0, max: 1000 })).length;
      byLength.set(length, (byLength.get(length) ?? 0) + 1);
    }
    for (const length of [1, 2, 3]) {
      expect((byLength.get(length) ?? 0) / draws, `${length}-digit share`).toBeGreaterThan(0.28);
    }
    expect((byLength.get(4) ?? 0) / draws, '"mil" share').toBeLessThan(0.01);
  });

  it('still gives a partly covered band its full digit-length share', () => {
    // 0..250 keeps 151 of the 900 three-digit values; a learner who asked for
    // hundreds should still meet them about a third of the time.
    const rng = createRng('partial-band');
    const draws = 6000;
    let hundreds = 0;
    for (let i = 0; i < draws; i++) {
      if (generateNumber(rng, { min: 0, max: 250 }) >= 100) hundreds++;
    }
    expect(hundreds / draws).toBeCloseTo(1 / 3, 1);
  });
});

describe('generatePrice', () => {
  const rng = createRng('gp');
  const draws = 4000;
  const buckets = { sub1: 0, a1to5: 0, b5to20: 0, c20to100: 0, d100to1000: 0 };
  let sub1WithZeroCents = 0;
  const centCounts = new Map<number, number>();
  for (let i = 0; i < draws; i++) {
    const { euros, cents } = generatePrice(rng);
    expect(euros).toBeGreaterThanOrEqual(0);
    expect(euros).toBeLessThan(1000);
    expect(cents).toBeGreaterThanOrEqual(0);
    expect(cents).toBeLessThan(100);
    if (euros === 0) {
      buckets.sub1++;
      if (cents === 0) sub1WithZeroCents++;
    } else if (euros <= 4) buckets.a1to5++;
    else if (euros <= 19) buckets.b5to20++;
    else if (euros <= 99) buckets.c20to100++;
    else buckets.d100to1000++;
    centCounts.set(cents, (centCounts.get(cents) ?? 0) + 1);
  }

  it('never prices a sub-euro item at ,00', () => {
    expect(sub1WithZeroCents).toBe(0);
  });

  it('follows the magnitude distribution within tolerance', () => {
    expect(buckets.sub1 / draws).toBeCloseTo(0.1, 1);
    expect(buckets.a1to5 / draws).toBeCloseTo(0.35, 1);
    expect(buckets.b5to20 / draws).toBeCloseTo(0.35, 1);
    expect(buckets.c20to100 / draws).toBeCloseTo(0.15, 1);
    expect(buckets.d100to1000 / draws).toBeCloseTo(0.05, 1);
  });

  it('weights common cent endings above the rest', () => {
    const ninetyNine = centCounts.get(99) ?? 0;
    const oddEnding = centCounts.get(1) ?? 0;
    expect(ninetyNine).toBeGreaterThan(oddEnding);
  });
});

describe('generateQuantity', () => {
  it('only emits weights the speller has a canonical form for', () => {
    const rng = createRng('gq');
    const allowed = new Set([
      50, 100, 150, 200, 250, 300, 400, 500, 600, 750, 800, 1500, 1200, 1800, 2200, 2500, 3500,
      1000, 2000, 3000, 4000, 5000,
    ]);
    const seenKinds = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const q = generateQuantity(rng);
      expect(q.kind).toBe('weight');
      expect(allowed.has(q.grams)).toBe(true);
      if (q.grams === 500) seenKinds.add('medio');
      else if (q.grams === 1500) seenKinds.add('kiloYMedio');
      else if (q.grams % 1000 === 0) seenKinds.add('wholeKg');
      else if (q.grams < 1000) seenKinds.add('grams');
      else seenKinds.add('decimalKg');
    }
    // The mix should exercise every broad category.
    expect(seenKinds).toContain('medio');
    expect(seenKinds).toContain('kiloYMedio');
    expect(seenKinds).toContain('wholeKg');
    expect(seenKinds).toContain('grams');
    expect(seenKinds).toContain('decimalKg');
  });
});
