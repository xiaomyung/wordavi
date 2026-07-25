import { describe, expect, it } from 'vitest';
import {
  type AnswerRecord,
  applyAnswersToDay,
  type DayRowLike,
  dayDiff,
  effectiveDailyGoal,
  evaluateStreak,
  type GoalVerdict,
  isGoalMet,
  localDayKey,
  localMonthKey,
  type StreakState,
  settleStreak,
  shiftDayKey,
  toGoalVerdicts,
} from '@/session';

function emptyDay(date = '2026-07-24'): DayRowLike {
  return { date, answered: 0, correct: 0, byGroup: {} };
}

describe('applyAnswersToDay', () => {
  it('counts answered for every verdict and correct for non-wrong', () => {
    const verdicts: GoalVerdict[] = [
      { group: 'small', counted: true },
      { group: 'small', counted: true }, // e.g. an almost
      { group: 'tens', counted: false }, // wrong
      { group: 'hundreds', counted: true },
    ];
    const day = applyAnswersToDay(emptyDay(), verdicts);
    expect(day.answered).toBe(4);
    expect(day.correct).toBe(3);
    expect(day.byGroup.small).toEqual({ answered: 2, correct: 2 });
    expect(day.byGroup.tens).toEqual({ answered: 1, correct: 0 });
    expect(day.byGroup.hundreds).toEqual({ answered: 1, correct: 1 });
  });

  it('accumulates onto an existing day without mutating it', () => {
    const day0: DayRowLike = {
      date: '2026-07-24',
      answered: 5,
      correct: 4,
      byGroup: { small: { answered: 5, correct: 4 } },
    };
    const day1 = applyAnswersToDay(day0, [{ group: 'small', counted: true }]);
    expect(day1.answered).toBe(6);
    expect(day1.correct).toBe(5);
    expect(day1.byGroup.small).toEqual({ answered: 6, correct: 5 });
    // original untouched
    expect(day0.answered).toBe(5);
    expect(day0.byGroup.small).toEqual({ answered: 5, correct: 4 });
  });

  it('isGoalMet compares counted answers to the target', () => {
    const day = { ...emptyDay(), correct: 20 };
    expect(isGoalMet(day, 20)).toBe(true);
    expect(isGoalMet({ ...day, correct: 19 }, 20)).toBe(false);
  });
});

describe('toGoalVerdicts', () => {
  function record(bucket: AnswerRecord['bucket'], verdict: AnswerRecord['verdict']): AnswerRecord {
    return { questionId: 'q', bucket, given: 'x', verdict, fromWrongQueue: false };
  }

  it('maps buckets to display groups and counts correct + almost', () => {
    expect(
      toGoalVerdicts([
        record('d0_15', 'correct'),
        record('tens_round', 'almost'),
        record('hundreds_irreg', 'wrong'),
        record('qty_grams', 'correct'),
        record('millions', 'correct'),
        record('price_cents', 'almost'),
      ]),
    ).toEqual([
      { group: 'small', counted: true },
      { group: 'tens', counted: true },
      { group: 'hundreds', counted: false },
      { group: 'weights', counted: true },
      { group: 'big', counted: true },
      { group: 'prices', counted: true },
    ]);
  });

  it('feeds a day row straight from a round', () => {
    const day = applyAnswersToDay(
      emptyDay(),
      toGoalVerdicts([record('d0_15', 'correct'), record('d0_15', 'wrong')]),
    );
    expect(day).toMatchObject({ answered: 2, correct: 1 });
    expect(isGoalMet(day, 1)).toBe(true);
  });
});

describe('effectiveDailyGoal', () => {
  it('never lets a day be met before a single answer', () => {
    expect(effectiveDailyGoal(0)).toBe(1);
    expect(effectiveDailyGoal(-5)).toBe(1);
    expect(effectiveDailyGoal(Number.NaN)).toBe(1);
    expect(effectiveDailyGoal(20)).toBe(20);
  });
});

describe('calendar day keys', () => {
  it('formats a local date as YYYY-MM-DD and YYYY-MM', () => {
    const date = new Date(2026, 6, 5, 23, 30); // local 2026-07-05
    expect(localDayKey(date)).toBe('2026-07-05');
    expect(localMonthKey(date)).toBe('2026-07');
  });

  it('shifts a key by whole days across month and year ends', () => {
    expect(shiftDayKey('2026-07-25', 1)).toBe('2026-07-26');
    expect(shiftDayKey('2026-07-01', -1)).toBe('2026-06-30');
    expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDayKey('2026-02-28', 1)).toBe('2026-03-01'); // 2026 non-leap
  });
});

describe('dayDiff', () => {
  it('measures whole calendar days', () => {
    expect(dayDiff('2026-07-24', '2026-07-25')).toBe(1);
    expect(dayDiff('2026-07-24', '2026-07-24')).toBe(0);
    expect(dayDiff('2026-07-25', '2026-07-24')).toBe(-1);
    expect(dayDiff('2026-02-28', '2026-03-01')).toBe(1); // 2026 non-leap
    expect(dayDiff('2026-12-31', '2027-01-01')).toBe(1);
  });
});

describe('settleStreak', () => {
  it('keeps a run stamped today', () => {
    const prev: StreakState = { current: 4, best: 9, lastGoalDate: '2026-07-25' };
    expect(settleStreak(prev, '2026-07-25')).toEqual(prev);
  });

  it('keeps a run stamped yesterday: today is still winnable', () => {
    const prev: StreakState = { current: 4, best: 9, lastGoalDate: '2026-07-24' };
    expect(settleStreak(prev, '2026-07-25')).toEqual(prev);
  });

  it('ends a run whose last stamped day is older than yesterday', () => {
    const prev: StreakState = { current: 7, best: 7, lastGoalDate: '2026-07-18' };
    expect(settleStreak(prev, '2026-07-25')).toEqual({
      current: 0,
      best: 7,
      lastGoalDate: '2026-07-18',
    });
  });

  it('measures the gap in calendar days across month and year ends', () => {
    for (const today of ['2026-08-01', '2027-01-01', '2026-03-01']) {
      const alive: StreakState = { current: 3, best: 3, lastGoalDate: shiftDayKey(today, -1) };
      expect(settleStreak(alive, today).current).toBe(3);
      const lapsed: StreakState = { current: 3, best: 3, lastGoalDate: shiftDayKey(today, -2) };
      expect(settleStreak(lapsed, today).current).toBe(0);
    }
  });

  it('settles on local calendar days, not elapsed hours', () => {
    // Just short of two full days apart, but one calendar day: still running.
    const prev: StreakState = {
      current: 2,
      best: 2,
      lastGoalDate: localDayKey(new Date(2026, 6, 24, 0, 1)),
    };
    expect(settleStreak(prev, localDayKey(new Date(2026, 6, 25, 23, 59))).current).toBe(2);
    // Barely over a day apart, but two calendar days: over.
    expect(settleStreak(prev, localDayKey(new Date(2026, 6, 26, 0, 5))).current).toBe(0);
  });

  it('has nothing to keep without a stamped day', () => {
    const fresh: StreakState = { current: 0, best: 0, lastGoalDate: null };
    expect(settleStreak(fresh, '2026-07-25')).toEqual(fresh);
    // A count with no day behind it cannot be verified; zero is the honest read.
    expect(settleStreak({ current: 5, best: 5, lastGoalDate: null }, '2026-07-25').current).toBe(0);
  });

  it('leaves a stamp dated ahead of today alone', () => {
    // The clock moved backwards (a timezone hop, a corrected device).
    const prev: StreakState = { current: 3, best: 3, lastGoalDate: '2026-07-26' };
    expect(settleStreak(prev, '2026-07-25')).toEqual(prev);
  });

  it('does not mutate the state it settles', () => {
    const prev: StreakState = { current: 7, best: 7, lastGoalDate: '2026-07-18' };
    settleStreak(prev, '2026-07-25');
    expect(prev).toEqual({ current: 7, best: 7, lastGoalDate: '2026-07-18' });
  });
});

describe('evaluateStreak', () => {
  const base: StreakState = { current: 0, best: 0, lastGoalDate: null };

  it('first qualifying day starts the streak at 1', () => {
    expect(evaluateStreak(base, '2026-07-24', true)).toEqual({
      current: 1,
      best: 1,
      lastGoalDate: '2026-07-24',
    });
  });

  it('increments on consecutive calendar days', () => {
    const d1 = evaluateStreak(base, '2026-07-24', true);
    const d2 = evaluateStreak(d1, '2026-07-25', true);
    expect(d2).toEqual({ current: 2, best: 2, lastGoalDate: '2026-07-25' });
  });

  it('is idempotent for repeated same-day calls', () => {
    const d1 = evaluateStreak(base, '2026-07-24', true);
    const again = evaluateStreak(d1, '2026-07-24', true);
    expect(again).toEqual(d1);
  });

  it('resets to 1 after a gap, preserving best', () => {
    const prev: StreakState = { current: 5, best: 5, lastGoalDate: '2026-07-20' };
    const next = evaluateStreak(prev, '2026-07-24', true);
    expect(next).toEqual({ current: 1, best: 5, lastGoalDate: '2026-07-24' });
  });

  it('a day short of the goal leaves the streak unchanged', () => {
    const prev: StreakState = { current: 3, best: 7, lastGoalDate: '2026-07-23' };
    expect(evaluateStreak(prev, '2026-07-24', false)).toEqual(prev);
  });

  it('grows best across a long consecutive run', () => {
    let s: StreakState = base;
    const days = ['2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24'];
    for (const d of days) s = evaluateStreak(s, d, true);
    expect(s).toEqual({ current: 4, best: 4, lastGoalDate: '2026-07-24' });
  });

  it('a run broken days ago is over before anything new is stamped', () => {
    const prev: StreakState = { current: 7, best: 7, lastGoalDate: '2026-07-18' };
    expect(evaluateStreak(prev, '2026-07-25', false)).toEqual({
      current: 0,
      best: 7,
      lastGoalDate: '2026-07-18',
    });
  });

  it('restarts at 1 without resurrecting the run it replaced', () => {
    const lapsed = evaluateStreak(
      { current: 7, best: 7, lastGoalDate: '2026-07-18' },
      '2026-07-25',
      false,
    );
    expect(evaluateStreak(lapsed, '2026-07-25', true)).toEqual({
      current: 1,
      best: 7,
      lastGoalDate: '2026-07-25',
    });
  });

  it('counts consecutive days over month and year ends', () => {
    expect(
      evaluateStreak({ current: 4, best: 4, lastGoalDate: '2026-07-31' }, '2026-08-01', true),
    ).toEqual({ current: 5, best: 5, lastGoalDate: '2026-08-01' });
    expect(
      evaluateStreak({ current: 9, best: 12, lastGoalDate: '2026-12-31' }, '2027-01-01', true),
    ).toEqual({ current: 10, best: 12, lastGoalDate: '2027-01-01' });
  });
});
