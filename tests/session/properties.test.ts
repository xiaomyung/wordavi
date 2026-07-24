import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  applyVerdict,
  initScore,
  initSrs,
  type SrsState,
  updateSrsOnAnswer,
  type Verdict,
  WRONG_QUEUE_CAP,
} from '@/session';
import { numberQuestion as makeQuestion } from './helpers';

const verdictArb = fc.constantFrom<Verdict>('correct', 'almost', 'wrong');

describe('score invariants (fast-check)', () => {
  it('combo is never negative and bestCombo dominates the running combo', () => {
    fc.assert(
      fc.property(fc.array(verdictArb), (verdicts) => {
        let score = initScore();
        for (const v of verdicts) {
          score = applyVerdict(score, v);
          expect(score.combo).toBeGreaterThanOrEqual(0);
          expect(score.bestCombo).toBeGreaterThanOrEqual(score.combo);
        }
      }),
    );
  });

  it('points are monotone non-decreasing', () => {
    fc.assert(
      fc.property(fc.array(verdictArb), (verdicts) => {
        let score = initScore();
        let prev = 0;
        for (const v of verdicts) {
          score = applyVerdict(score, v);
          expect(score.points).toBeGreaterThanOrEqual(prev);
          prev = score.points;
        }
      }),
    );
  });
});

describe('SRS invariants (fast-check)', () => {
  it('wrongQueue never exceeds the cap', () => {
    const opArb = fc.record({
      id: fc.integer({ min: 0, max: 250 }),
      verdict: verdictArb,
    });
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 400 }), (ops) => {
        let srs: SrsState = initSrs();
        for (const op of ops) {
          srs = updateSrsOnAnswer(srs, makeQuestion(`id${op.id}`, op.id % 16), op.verdict);
          expect(srs.wrongQueue.length).toBeLessThanOrEqual(WRONG_QUEUE_CAP);
        }
      }),
    );
  });

  it('bucket correct never exceeds attempts and answeredCount tracks total ops', () => {
    fc.assert(
      fc.property(fc.array(verdictArb, { maxLength: 200 }), (verdicts) => {
        let srs: SrsState = initSrs();
        verdicts.forEach((v, i) => {
          srs = updateSrsOnAnswer(srs, makeQuestion(`id${i}`, i % 16), v);
        });
        expect(srs.answeredCount).toBe(verdicts.length);
        for (const bucket of Object.values(srs.buckets)) {
          expect(bucket.correct).toBeLessThanOrEqual(bucket.attempts);
          expect(bucket.last20.length).toBeLessThanOrEqual(20);
        }
      }),
    );
  });
});
