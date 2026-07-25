import { slog } from './log';
import {
  type AnswerRecord,
  BUCKET_TO_GROUP,
  type DayRowLike,
  type GoalVerdict,
  type StreakState,
  type Verdict,
} from './types';

/** Milliseconds in a calendar day — the unit all day-key arithmetic here uses. */
export const DAY_MS = 86_400_000;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Local calendar day as YYYY-MM-DD (the key shape the storage day rows use). */
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Local calendar month as YYYY-MM (the key `computeStats` aggregates on). */
export function localMonthKey(date: Date): string {
  return localDayKey(date).slice(0, 7);
}

/** Shift a YYYY-MM-DD key by whole days (UTC math, so DST never shifts a date). */
export function shiftDayKey(key: string, deltaDays: number): string {
  const parts = key.split('-');
  const utc =
    Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) + deltaDays * DAY_MS;
  const shifted = new Date(utc);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

/**
 * The goal a day is actually measured against. A stored 0 (or a corrupt
 * negative) would otherwise be met before the learner answered anything, which
 * would stamp the day and grow the streak for free.
 */
export function effectiveDailyGoal(goal: number): number {
  return Math.max(1, goal || 0);
}

/**
 * Whether an answer counts towards the daily goal. An 'almost' is a hit: the
 * learner said the number, they just missed an accent. Everything that tallies
 * counted answers — the day row, the lifetime totals — asks this one function, so
 * the two can never come to disagree about what "correct" means.
 */
export function countsAsCorrect(verdict: Verdict): boolean {
  return verdict !== 'wrong';
}

/**
 * Project a round's answers onto the daily-goal vocabulary: display group plus
 * whether the answer counts toward the goal (correct and almost both do).
 */
export function toGoalVerdicts(records: readonly AnswerRecord[]): GoalVerdict[] {
  return records.map((record) => ({
    group: BUCKET_TO_GROUP[record.bucket],
    counted: countsAsCorrect(record.verdict),
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
 * A stored streak read against the calendar (pure). `current` is only ever
 * written when a day earns its stamp, so between stamps it is a claim about the
 * past that the clock can invalidate on its own: once the last stamped day is
 * older than yesterday the run is over, and every read has to say so rather than
 * wait for the next stamp to correct it. `best` and `lastGoalDate` are the record
 * of what happened and are left exactly as they are.
 */
export function settleStreak(prev: StreakState, today: string): StreakState {
  // Yesterday still counts: today has not been played out yet. A date in the
  // future means the clock moved backwards (a timezone hop, a corrected
  // device) — not something to punish a learner for.
  const alive = prev.lastGoalDate !== null && dayDiff(prev.lastGoalDate, today) <= 1;
  return alive ? { ...prev } : { ...prev, current: 0 };
}

/**
 * Streak transition (pure). Local dates are passed as YYYY-MM-DD; the caller owns
 * the timezone. A day earns its stamp when the goal is met; the current streak
 * increments once per qualifying day when calendar-consecutive, restarts at 1 on a
 * gap, and is idempotent for repeated same-day calls. `best` is always preserved.
 */
export function evaluateStreak(prev: StreakState, today: string, goalMet: boolean): StreakState {
  // Days that passed without a stamp count first — otherwise a run broken three
  // days ago would be carried forward untouched by every call that has nothing
  // to stamp.
  const settled = settleStreak(prev, today);
  // Nothing to stamp yet, or today is already stamped (repeat calls are
  // idempotent) — either way the streak stands as settled.
  if (!goalMet || settled.lastGoalDate === today) return settled;
  const consecutive = settled.lastGoalDate !== null && dayDiff(settled.lastGoalDate, today) === 1;
  const current = consecutive ? settled.current + 1 : 1;
  const best = Math.max(settled.best, current);
  slog('info', 'goal.streak', { current, best, today, consecutive });
  return { current, best, lastGoalDate: today };
}
