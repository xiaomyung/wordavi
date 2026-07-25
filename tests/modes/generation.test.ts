import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine';
import { allModes, drawForBucket, getMode, NUMBER_BUCKETS, planFor, roundRange } from '@/modes';
import { classifyBucket, classifyNumber, type SkillBucket } from '@/session';
import { generateFor, roundConfig } from './helpers';

const NUMBER_MODES = ['words', 'digits', 'listen', 'choice', 'speak'] as const;
const SEEDS = [1, 7, 42, 1234, 98_765];

describe('bucket → value-range mapping', () => {
  it.each(NUMBER_BUCKETS)('%s draws only values it classifies as', (bucket) => {
    const range = roundRange(roundConfig({ rangeMin: 0, rangeMax: 999_999_999 }));
    for (const seed of SEEDS) {
      const value = drawForBucket(createRng(seed), bucket, range);
      expect(value, `${bucket} @ ${seed}`).not.toBeNull();
      expect(classifyNumber(value as number)).toBe(bucket);
    }
  });

  it('plans nothing for a bucket the range excludes', () => {
    const narrow = { min: 0, max: 100 };
    expect(planFor('hundreds_irreg', narrow)).toBeNull();
    expect(planFor('thousands', narrow)).toBeNull();
    expect(planFor('millions', narrow)).toBeNull();
    expect(planFor('d0_15', narrow)).not.toBeNull();
  });

  it('clips a partially covered bucket instead of dropping it', () => {
    // 30..35 covers one round ten (30) and five "y" numbers.
    expect(drawForBucket(createRng(3), 'tens_round', { min: 30, max: 35 })).toBe(30);
    for (const seed of SEEDS) {
      const value = drawForBucket(createRng(seed), 'tens_y', { min: 30, max: 35 });
      expect(value).toBeGreaterThanOrEqual(31);
      expect(value).toBeLessThanOrEqual(35);
    }
  });

  it('sanitises an inverted or negative configured range', () => {
    expect(roundRange(roundConfig({ rangeMin: 500, rangeMax: 20 }))).toEqual({ min: 20, max: 500 });
    expect(roundRange(roundConfig({ rangeMin: -50, rangeMax: 10 }))).toEqual({ min: 0, max: 10 });
  });
});

describe.each(NUMBER_MODES)('%s generation', (id) => {
  const mode = getMode(id);

  it('declares every number bucket for the widest range', () => {
    expect(mode.source.eligibleBuckets(roundConfig({ rangeMin: 0, rangeMax: 1_000_000 }))).toEqual([
      ...NUMBER_BUCKETS,
    ]);
  });

  it('drops buckets the configured range cannot reach', () => {
    const eligible = mode.source.eligibleBuckets(roundConfig({ rangeMin: 0, rangeMax: 99 }));
    expect(eligible).toEqual(['d0_15', 'teens_fused', 'twenties_fused', 'tens_round', 'tens_y']);
  });

  it('admits a bucket the range only just reaches', () => {
    // 100 is the single hundreds_reg value inside 0..100 — "cien" is fair game.
    expect(mode.source.eligibleBuckets(roundConfig({ rangeMin: 0, rangeMax: 100 }))).toContain(
      'hundreds_reg',
    );
  });

  it('generates in the suggested bucket for every eligible bucket', () => {
    const config = roundConfig({ rangeMin: 0, rangeMax: 1_000_000 });
    for (const bucket of mode.source.eligibleBuckets(config)) {
      for (const seed of SEEDS) {
        const question = generateFor(mode, bucket, seed, config);
        expect(classifyBucket(question.prompt), `${bucket} @ ${seed}`).toBe(bucket);
      }
    }
  });

  it('stays inside the configured range', () => {
    const config = roundConfig({ rangeMin: 0, rangeMax: 100 });
    for (const bucket of mode.source.eligibleBuckets(config)) {
      for (const seed of SEEDS) {
        const question = generateFor(mode, bucket, seed, config);
        expect(question.prompt.kind).toBe('number');
        if (question.prompt.kind !== 'number') return;
        expect(question.prompt.value).toBeGreaterThanOrEqual(0);
        expect(question.prompt.value).toBeLessThanOrEqual(100);
      }
    }
  });

  it('falls back to the range when handed a bucket it cannot serve', () => {
    const config = roundConfig({ rangeMin: 0, rangeMax: 100 });
    const question = generateFor(mode, 'price_cents' as SkillBucket, 5, config);
    expect(question.prompt.kind).toBe('number');
    if (question.prompt.kind !== 'number') return;
    expect(question.prompt.value).toBeLessThanOrEqual(100);
  });

  it('is deterministic for a seed and carries a stable id', () => {
    const config = roundConfig();
    const first = generateFor(mode, 'tens_y', 99, config);
    const second = generateFor(mode, 'tens_y', 99, config);
    expect(second).toEqual(first);
    expect(first.id.startsWith(`${id}:`)).toBe(true);
  });
});

describe('grocery generation', () => {
  const grocery = getMode('grocery');

  it('declares the price and quantity buckets only', () => {
    expect(grocery.source.eligibleBuckets(roundConfig())).toEqual([
      'price_cents',
      'qty_fractions',
      'qty_grams',
    ]);
  });

  it('ignores the number-range slider', () => {
    expect(grocery.source.eligibleBuckets(roundConfig({ rangeMin: 0, rangeMax: 10 }))).toEqual(
      grocery.source.eligibleBuckets(roundConfig({ rangeMin: 0, rangeMax: 1_000_000 })),
    );
  });

  it('generates in the suggested bucket for every eligible bucket', () => {
    for (const bucket of grocery.source.eligibleBuckets(roundConfig())) {
      for (const seed of SEEDS) {
        const question = generateFor(grocery, bucket, seed);
        expect(classifyBucket(question.prompt), `${bucket} @ ${seed}`).toBe(bucket);
      }
    }
  });

  it('mixes prices and weights when no grocery bucket is suggested', () => {
    const kinds = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      kinds.add(generateFor(grocery, 'd0_15', seed).prompt.kind);
    }
    expect(kinds).toEqual(new Set(['price', 'quantity']));
  });

  it('stamps the bucket it will be classified into', () => {
    for (const bucket of grocery.source.eligibleBuckets(roundConfig())) {
      const question = generateFor(grocery, bucket, 11);
      expect(question.bucket).toBe(classifyBucket(question.prompt));
    }
  });
});

describe('every mode covers a distinct part of the skill map', () => {
  it('leaves only the decimals bucket unclaimed', () => {
    const covered = new Set<SkillBucket>();
    for (const mode of allModes()) {
      for (const bucket of mode.source.eligibleBuckets(roundConfig())) covered.add(bucket);
    }
    expect(covered.has('decimals')).toBe(false);
    expect(covered.size).toBe(12);
  });
});
