import { describe, expect, it } from 'vitest';
import {
  accuracyOf,
  type BucketStat,
  deserializeSrs,
  dueDelay,
  errorRateOf,
  initSrs,
  masteryFloorOf,
  pickBucket,
  pickDueWrongItem,
  type Question,
  type SkillBucket,
  type SrsState,
  serializeSrs,
  updateSrsOnAnswer,
  WRONG_QUEUE_CAP,
  weightOf,
} from '@/session';
import { constRng, numberQuestion } from './helpers';

function stat(attempts: number, last20: boolean[]): BucketStat {
  return { attempts, correct: last20.filter((x) => x).length, last20 };
}

function fill(n: number, ok: boolean): boolean[] {
  return Array.from({ length: n }, () => ok);
}

function q(id: string, value = 5): Question {
  return numberQuestion(id, value);
}

describe('SRS weight & mastery', () => {
  it('fresh bucket weighs 1 (no attempts)', () => {
    expect(weightOf(stat(0, []))).toBe(1);
    expect(masteryFloorOf(stat(0, []))).toBe(1);
    expect(errorRateOf(stat(0, []))).toBe(0);
    expect(accuracyOf(stat(0, []))).toBe(0);
  });

  it('errorRate scales weight: 50% wrong -> (1 + 3*0.5) = 2.5', () => {
    const s = stat(4, [true, false, true, false]);
    expect(errorRateOf(s)).toBe(0.5);
    expect(masteryFloorOf(s)).toBe(1); // attempts < 10
    expect(weightOf(s)).toBeCloseTo(2.5, 10);
  });

  it('mastery floor applies at exactly 90% accuracy AND exactly 10 attempts', () => {
    const s = stat(10, [...fill(9, true), false]); // 9/10 = 0.9
    expect(accuracyOf(s)).toBeCloseTo(0.9, 10);
    expect(masteryFloorOf(s)).toBe(0.2);
    // (1 + 3*0.1) * 0.2 = 0.26
    expect(weightOf(s)).toBeCloseTo(0.26, 10);
  });

  it('no floor just below the thresholds', () => {
    const belowAttempts = stat(9, fill(9, true)); // accuracy 1.0 but attempts 9 < 10
    expect(accuracyOf(belowAttempts)).toBe(1);
    expect(masteryFloorOf(belowAttempts)).toBe(1);

    const belowAccuracy = stat(10, [...fill(8, true), false, false]); // 0.8, attempts 10
    expect(masteryFloorOf(belowAccuracy)).toBe(1);
  });

  it('mastery floor over a full last-20 ring (18/20 = 0.9)', () => {
    const s = stat(25, [...fill(18, true), false, false]);
    expect(accuracyOf(s)).toBeCloseTo(0.9, 10);
    expect(masteryFloorOf(s)).toBe(0.2);
  });
});

describe('pickBucket weighted draw', () => {
  const eligible: SkillBucket[] = ['d0_15', 'teens_fused'];

  function srsWith(bBucketErrors: boolean): SrsState {
    const srs = initSrs();
    srs.buckets.d0_15 = stat(0, []); // weight 1
    srs.buckets.teens_fused = bBucketErrors
      ? stat(4, fill(4, false)) // errorRate 1 -> weight 4
      : stat(0, []);
    return srs;
  }

  it('is deterministic and stays within the eligible set', () => {
    const srs = srsWith(true);
    for (const v of [0, 0.1, 0.5, 0.9, 0.999]) {
      expect(eligible).toContain(pickBucket(constRng(v), srs, eligible));
    }
  });

  it('rng at 0 picks the first eligible bucket', () => {
    expect(pickBucket(constRng(0), srsWith(true), eligible)).toBe('d0_15');
  });

  it('respects weight bands (weights 1 and 4, total 5)', () => {
    const srs = srsWith(true);
    // r = rng*5; d0_15 band is r <= 1 (rng <= 0.2), else teens_fused
    expect(pickBucket(constRng(0.1), srs, eligible)).toBe('d0_15');
    expect(pickBucket(constRng(0.5), srs, eligible)).toBe('teens_fused');
  });

  it('throws with no eligible buckets', () => {
    expect(() => pickBucket(constRng(0), initSrs(), [])).toThrow();
  });
});

describe('wrongQueue lifecycle', () => {
  it('schedules due at +3, then +8, then +20 by reappearance', () => {
    let srs = initSrs();

    srs = updateSrsOnAnswer(srs, q('x'), 'wrong');
    expect(srs.answeredCount).toBe(1);
    expect(srs.wrongQueue).toHaveLength(1);
    expect(srs.wrongQueue[0]?.dueAt).toBe(1 + 3);
    expect(srs.wrongQueue[0]?.reappearances).toBe(0);

    srs = updateSrsOnAnswer(srs, { ...q('x'), fromWrongQueue: true }, 'correct');
    expect(srs.answeredCount).toBe(2);
    expect(srs.wrongQueue[0]?.consecutiveCorrect).toBe(1);
    expect(srs.wrongQueue[0]?.reappearances).toBe(1);
    expect(srs.wrongQueue[0]?.dueAt).toBe(2 + 8);

    srs = updateSrsOnAnswer(srs, { ...q('x'), fromWrongQueue: true }, 'wrong');
    expect(srs.answeredCount).toBe(3);
    expect(srs.wrongQueue[0]?.consecutiveCorrect).toBe(0);
    expect(srs.wrongQueue[0]?.reappearances).toBe(2);
    expect(srs.wrongQueue[0]?.dueAt).toBe(3 + 20);
  });

  it('leaves the queue after 2 consecutive correct answers of the same item', () => {
    let srs = updateSrsOnAnswer(initSrs(), q('x'), 'wrong');
    srs = updateSrsOnAnswer(srs, { ...q('x'), fromWrongQueue: true }, 'correct');
    expect(srs.wrongQueue).toHaveLength(1);
    srs = updateSrsOnAnswer(srs, { ...q('x'), fromWrongQueue: true }, 'correct');
    expect(srs.wrongQueue).toHaveLength(0);
  });

  it('a wrong answer resets the consecutive-correct counter', () => {
    let srs = updateSrsOnAnswer(initSrs(), q('x'), 'wrong');
    srs = updateSrsOnAnswer(srs, { ...q('x'), fromWrongQueue: true }, 'correct'); // cc 1
    srs = updateSrsOnAnswer(srs, { ...q('x'), fromWrongQueue: true }, 'wrong'); // reset
    expect(srs.wrongQueue[0]?.consecutiveCorrect).toBe(0);
    srs = updateSrsOnAnswer(srs, { ...q('x'), fromWrongQueue: true }, 'correct'); // cc 1 again
    expect(srs.wrongQueue).toHaveLength(1);
  });

  it('caps the queue at 50, dropping the oldest', () => {
    let srs = initSrs();
    for (let i = 0; i < 60; i += 1) {
      srs = updateSrsOnAnswer(srs, q(`w${i}`, i % 16), 'wrong');
    }
    expect(srs.wrongQueue).toHaveLength(WRONG_QUEUE_CAP);
    expect(srs.wrongQueue[0]?.question.id).toBe('w10'); // w0..w9 dropped
    expect(srs.wrongQueue.at(-1)?.question.id).toBe('w59');
  });

  it('a correct answer to a non-queued question never enqueues', () => {
    const srs = updateSrsOnAnswer(initSrs(), q('x'), 'correct');
    expect(srs.wrongQueue).toHaveLength(0);
    expect(srs.buckets.d0_15.attempts).toBe(1);
    expect(srs.buckets.d0_15.correct).toBe(1);
  });

  it('dueDelay follows the 3/8/20 schedule', () => {
    expect(dueDelay(0)).toBe(3);
    expect(dueDelay(1)).toBe(8);
    expect(dueDelay(2)).toBe(20);
    expect(dueDelay(5)).toBe(20);
  });
});

describe('wrongQueue ≤1-per-3 pacing (pickDueWrongItem)', () => {
  function dueSrs(): SrsState {
    const srs = initSrs();
    srs.answeredCount = 5;
    srs.wrongQueue.push({ question: q('x'), reappearances: 0, consecutiveCorrect: 0, dueAt: 0 });
    return srs;
  }

  it('requires a gap of at least 3 served questions since the last injection', () => {
    const srs = dueSrs();
    expect(pickDueWrongItem(srs, 5, -3)).not.toBeNull();
    expect(pickDueWrongItem(srs, 5, 4)).toBeNull(); // gap 1
    expect(pickDueWrongItem(srs, 6, 4)).toBeNull(); // gap 2
    expect(pickDueWrongItem(srs, 7, 4)).not.toBeNull(); // gap 3
  });

  it('returns null when nothing is due yet', () => {
    const srs = dueSrs();
    const item = srs.wrongQueue[0];
    if (item) item.dueAt = 100;
    expect(pickDueWrongItem(srs, 10, -3)).toBeNull();
  });

  it('picks the most-overdue item first', () => {
    const srs = initSrs();
    srs.answeredCount = 30;
    srs.wrongQueue.push({
      question: q('late'),
      reappearances: 0,
      consecutiveCorrect: 0,
      dueAt: 20,
    });
    srs.wrongQueue.push({
      question: q('early'),
      reappearances: 0,
      consecutiveCorrect: 0,
      dueAt: 5,
    });
    expect(pickDueWrongItem(srs, 10, -3)?.question.id).toBe('early');
  });
});

describe('SRS serialization', () => {
  it('round-trips through JSON', () => {
    let srs = updateSrsOnAnswer(initSrs(), q('a'), 'wrong');
    srs = updateSrsOnAnswer(srs, q('b', 20), 'correct');
    srs = updateSrsOnAnswer(srs, { ...q('a'), fromWrongQueue: true }, 'almost');
    const json: unknown = JSON.parse(JSON.stringify(serializeSrs(srs)));
    expect(deserializeSrs(json)).toEqual(srs);
  });

  it('falls back to a fresh state on corruption', () => {
    expect(deserializeSrs(null)).toEqual(initSrs());
    expect(deserializeSrs('garbage')).toEqual(initSrs());
    expect(deserializeSrs({ version: 2 })).toEqual(initSrs());
    expect(deserializeSrs({ version: 1, answeredCount: 'x' })).toEqual(initSrs());
  });
});
