import { describe, expect, it } from 'vitest';
import { classifyBucket, classifyNumber, type PromptPayload, type SkillBucket } from '@/session';

describe('bucket classifier — numbers', () => {
  const table: [number, SkillBucket][] = [
    [0, 'd0_15'],
    [7, 'd0_15'],
    [15, 'd0_15'],
    [16, 'teens_fused'],
    [19, 'teens_fused'],
    [20, 'twenties_fused'],
    [25, 'twenties_fused'],
    [29, 'twenties_fused'],
    [30, 'tens_round'],
    [31, 'tens_y'],
    [47, 'tens_y'],
    [90, 'tens_round'],
    [99, 'tens_y'],
    [100, 'hundreds_reg'],
    [101, 'hundreds_reg'],
    [347, 'hundreds_reg'],
    [500, 'hundreds_irreg'],
    [547, 'hundreds_irreg'],
    [700, 'hundreds_irreg'],
    [999, 'hundreds_irreg'],
    [1000, 'thousands'],
    [21000, 'thousands'],
    [1000000, 'millions'],
  ];

  for (const [value, bucket] of table) {
    it(`${value} -> ${bucket}`, () => {
      expect(classifyNumber(value)).toBe(bucket);
      expect(classifyBucket({ kind: 'number', value })).toBe(bucket);
    });
  }

  it('classifies the round tens 40/50/60/70/80 as tens_round', () => {
    for (const v of [40, 50, 60, 70, 80]) expect(classifyNumber(v)).toBe('tens_round');
  });

  it('classifies 600/800 hundreds as regular, 900 as irregular', () => {
    expect(classifyNumber(600)).toBe('hundreds_reg');
    expect(classifyNumber(800)).toBe('hundreds_reg');
    expect(classifyNumber(900)).toBe('hundreds_irreg');
  });
});

describe('bucket classifier — non-number payloads', () => {
  const table: [PromptPayload, SkillBucket][] = [
    [{ kind: 'price', euros: 4, cents: 75 }, 'price_cents'],
    [{ kind: 'decimal', intPart: 3, fracDigits: 14 }, 'decimals'],
    [{ kind: 'quantity', grams: 500 }, 'qty_fractions'],
    [{ kind: 'quantity', grams: 250 }, 'qty_fractions'],
    [{ kind: 'quantity', grams: 1500 }, 'qty_fractions'],
    [{ kind: 'quantity', grams: 300 }, 'qty_grams'],
    [{ kind: 'quantity', grams: 125 }, 'qty_grams'],
  ];

  for (const [payload, bucket] of table) {
    it(`${JSON.stringify(payload)} -> ${bucket}`, () => {
      expect(classifyBucket(payload)).toBe(bucket);
    });
  }
});
