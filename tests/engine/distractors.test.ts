import { describe, expect, it } from 'vitest';
import { buildDistractors, confusablesOf, createRng } from '@/engine';

describe('confusablesOf', () => {
  it('captures the classic es-ES number confusions', () => {
    expect(confusablesOf(60)).toContain(70); // sesenta / setenta
    expect(confusablesOf(70)).toContain(60);
    expect(confusablesOf(15)).toContain(50); // quince / cincuenta
    expect(confusablesOf(13)).toContain(30); // trece / treinta
    expect(confusablesOf(500)).toContain(700); // quinientos / setecientos
    expect(confusablesOf(500)).toContain(900);
  });
});

describe('buildDistractors', () => {
  const RANGE = { min: 0, max: 1000 };

  it('returns three distinct distractors, all ≠ answer and in range', () => {
    for (let answer = 0; answer <= 1000; answer += 7) {
      for (let s = 0; s < 8; s++) {
        const out = buildDistractors(answer, createRng(`${answer}:${s}`), RANGE);
        expect(out).toHaveLength(3);
        expect(new Set(out).size).toBe(3);
        for (const value of out) {
          expect(value).not.toBe(answer);
          expect(value).toBeGreaterThanOrEqual(RANGE.min);
          expect(value).toBeLessThanOrEqual(RANGE.max);
        }
      }
    }
  });

  it('is deterministic for a given seed', () => {
    const a = buildDistractors(60, createRng('seed-1'), RANGE);
    const b = buildDistractors(60, createRng('seed-1'), RANGE);
    expect(a).toEqual(b);
  });

  it('surfaces a confusable in ≥50% of draws for eligible answers', () => {
    const range = { min: 0, max: 100 };
    const eligible = [13, 15, 16, 19, 50, 60, 70, 90];
    for (const answer of eligible) {
      const pool = new Set(confusablesOf(answer).filter((v) => v >= range.min && v <= range.max));
      expect(pool.size).toBeGreaterThan(0);
      let hits = 0;
      const draws = 40;
      for (let s = 0; s < draws; s++) {
        const out = buildDistractors(answer, createRng(`${answer}-${s}`), range);
        if (out.some((v) => pool.has(v))) hits++;
      }
      expect(hits / draws).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('specifically offers the tens/units swap partner', () => {
    const draws = 30;
    let sixtyHasSeventy = 0;
    for (let s = 0; s < draws; s++) {
      if (buildDistractors(60, createRng(`60-${s}`), { min: 0, max: 100 }).includes(70)) {
        sixtyHasSeventy++;
      }
    }
    expect(sixtyHasSeventy / draws).toBeGreaterThanOrEqual(0.5);
  });
});
