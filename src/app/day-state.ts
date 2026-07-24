/**
 * The day-goal facts the summary card needs, sampled the moment a round ends.
 *
 * `stampedToday` has to be read *before* the round is counted, and by the time
 * `onFinish` fires the day row already includes it — so the only honest way to
 * ask "was the stamp already there?" is to subtract this round's counted
 * answers back out. Getting it wrong would celebrate the same stamp twice.
 */

import type { SummaryDayState } from '@/screens/SummaryScreen';
import { localDayKey } from '@/screens/streak-window';
import type { RoundSummary } from '@/session';
import { getDay, getProgress, getSettings } from '@/storage';

export function summaryDayState(summary: RoundSummary, now: Date = new Date()): SummaryDayState {
  // A goal of zero would stamp every day before a single answer; the home
  // screen guards it the same way.
  const total = Math.max(1, getSettings().dailyGoal);
  // `correct` counts every non-wrong answer (correct + almost), exactly what
  // `summary.correctCount` counts — so the two are subtractable.
  const done = getDay(localDayKey(now))?.correct ?? 0;
  const goalMet = done >= total;

  return {
    goalMet,
    stampedToday: goalMet && done - summary.correctCount >= total,
    streakDays: getProgress().streakCurrent,
    done: Math.min(done, total),
    total,
  };
}
