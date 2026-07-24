import { slog } from './log';
import {
  type AnswerRecord,
  BUCKET_TO_GROUP,
  type DayRowLike,
  type GoalVerdict,
  type StreakState,
} from './types';

const DAY_MS = 86_400_000;

/**
 * Project a round's answers onto the daily-goal vocabulary: display group plus
 * whether the answer counts toward the goal (correct and almost both do).
 */
export function toGoalVerdicts(records: readonly AnswerRecord[]): GoalVerdict[] {
  return records.map((record) => ({
    group: BUCKET_TO_GROUP[record.bucket],
    counted: record.verdict !== 'wrong',
  }));
}

/** Parse a YYYY-MM-DD calendar date to a UTC epoch (timezone-agnostic day math). */
function dayToUtc(date: string): number {
  const parts = date.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return Date.UTC(y, m - 1, d);
}

/** Whole-calendar-day difference b - a (in days). */
export function dayDiff(a: string, b: string): number {
  return Math.round((dayToUtc(b) - dayToUtc(a)) / DAY_MS);
}

/**
 * Fold a batch of answers into a day row (pure). `answered` counts every verdict;
 * `correct` counts non-wrong (correct + almost). Per-group tallies mirror this.
 */
export function applyAnswersToDay(day: DayRowLike, verdicts: readonly GoalVerdict[]): DayRowLike {
  const byGroup: DayRowLike['byGroup'] = {};
  for (const [key, stat] of Object.entries(day.byGroup)) {
    byGroup[key] = { answered: stat.answered, correct: stat.correct };
  }
  let answered = day.answered;
  let correct = day.correct;
  for (const v of verdicts) {
    answered += 1;
    if (v.counted) correct += 1;
    const g = byGroup[v.group] ?? { answered: 0, correct: 0 };
    byGroup[v.group] = { answered: g.answered + 1, correct: g.correct + (v.counted ? 1 : 0) };
  }
  return { date: day.date, answered, correct, byGroup };
}

/** A day meets its goal once its counted answers (correct + almost) reach the target. */
export function isGoalMet(day: DayRowLike, dailyGoal: number): boolean {
  return day.correct >= dailyGoal;
}

/**
 * Streak transition (pure). Local dates are passed as YYYY-MM-DD; the caller owns
 * the timezone. A day earns its stamp when the goal is met; the current streak
 * increments once per qualifying day when calendar-consecutive, restarts at 1 on a
 * gap, and is idempotent for repeated same-day calls. `best` is always preserved.
 */
export function evaluateStreak(prev: StreakState, today: string, goalMet: boolean): StreakState {
  if (!goalMet) {
    return { current: prev.current, best: prev.best, lastGoalDate: prev.lastGoalDate };
  }
  if (prev.lastGoalDate === today) {
    // Already stamped today — idempotent.
    return { current: prev.current, best: prev.best, lastGoalDate: prev.lastGoalDate };
  }
  const consecutive = prev.lastGoalDate !== null && dayDiff(prev.lastGoalDate, today) === 1;
  const current = consecutive ? prev.current + 1 : 1;
  const best = Math.max(prev.best, current);
  slog('info', 'goal.streak', { current, best, today, consecutive });
  return { current, best, lastGoalDate: today };
}
