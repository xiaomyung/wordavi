import { describe, expect, it } from 'vitest';
import {
  BUCKET_TO_GROUP,
  computeStats,
  type DayRowLike,
  DISPLAY_GROUP_ORDER,
  DISPLAY_GROUPS,
  initSrs,
  type SrsState,
} from '@/session';

function fill(n: number, ok: boolean): boolean[] {
  return Array.from({ length: n }, () => ok);
}

function seededSrs(): SrsState {
  const srs = initSrs();
  srs.buckets.d0_15 = { attempts: 5, correct: 4, last20: [true, true, true, true, false] };
  srs.buckets.teens_fused = { attempts: 5, correct: 5, last20: fill(5, true) };
  srs.buckets.hundreds_reg = { attempts: 2, correct: 1, last20: [true, false] };
  return srs;
}

const days: DayRowLike[] = [
  { date: '2026-07-01', answered: 10, correct: 8, byGroup: {} },
  { date: '2026-07-15', answered: 20, correct: 15, byGroup: {} },
  { date: '2026-06-30', answered: 5, correct: 5, byGroup: {} },
];

describe('display group mapping', () => {
  it('covers all 13 buckets exactly once', () => {
    const all = DISPLAY_GROUP_ORDER.flatMap((g) => DISPLAY_GROUPS[g]);
    expect(new Set(all).size).toBe(13);
    expect(Object.keys(BUCKET_TO_GROUP)).toHaveLength(13);
  });

  it('BUCKET_TO_GROUP is the inverse of DISPLAY_GROUPS', () => {
    expect(BUCKET_TO_GROUP.d0_15).toBe('small');
    expect(BUCKET_TO_GROUP.tens_round).toBe('tens');
    expect(BUCKET_TO_GROUP.hundreds_irreg).toBe('hundreds');
    expect(BUCKET_TO_GROUP.thousands).toBe('big');
    expect(BUCKET_TO_GROUP.millions).toBe('big');
    expect(BUCKET_TO_GROUP.price_cents).toBe('prices');
    expect(BUCKET_TO_GROUP.qty_grams).toBe('weights');
  });
});

describe('computeStats', () => {
  it('aggregates per-group lifetime accuracy from the SRS state', () => {
    const stats = computeStats(seededSrs(), days, '2026-07');
    expect(stats.groups.small).toEqual({
      attempts: 10,
      correct: 9,
      accuracy: 0.9,
      recentAccuracy: 0.9,
    });
    expect(stats.groups.hundreds).toMatchObject({ attempts: 2, correct: 1, accuracy: 0.5 });
    expect(stats.groups.big).toEqual({
      attempts: 0,
      correct: 0,
      accuracy: 0,
      recentAccuracy: 0,
    });
  });

  it('totals every bucket', () => {
    const stats = computeStats(seededSrs(), days, '2026-07');
    expect(stats.totals.attempts).toBe(12);
    expect(stats.totals.correct).toBe(10);
  });

  it('computes month accuracy from matching day rows only', () => {
    const stats = computeStats(seededSrs(), days, '2026-07');
    expect(stats.month.answered).toBe(30); // June row excluded
    expect(stats.month.correct).toBe(23);
    expect(stats.month.accuracy).toBeCloseTo(23 / 30, 10);
  });

  it('handles an empty month', () => {
    const stats = computeStats(initSrs(), days, '2025-01');
    expect(stats.month).toEqual({ key: '2025-01', answered: 0, correct: 0, accuracy: 0 });
    expect(stats.totals.accuracy).toBe(0);
  });
});
