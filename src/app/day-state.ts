/**
 * The day-goal facts the summary card needs, sampled the moment a round ends.
 *
 * "Was the stamp already there?" cannot be recovered by arithmetic here. It used
 * to be: a round was folded into today's row in one batch, so subtracting its own
 * counted answers back out gave the figure from before it. Answers are now
 * counted as they are given ([[adr-027]]), and a round played across midnight has
 * some of them on yesterday's row — subtracting all of them would under-read
 * today and re-celebrate a stamp the learner already earned.
 *
 * So the answer is carried rather than derived: `commitAnswer` reports the answer
 * that flipped the day from unmet to met, and the drill passes that on.
 */

import type { SummaryDayState } from '@/screens/SummaryScreen';
import { effectiveDailyGoal, localDayKey } from '@/session';
import { getDay, getProgress, getSettings } from '@/storage';

/**
 * @param stampEarned whether one of this round's answers is what met today's goal
 * @param now the clock reading that decides which local day is being described
 */
export function summaryDayState(stampEarned: boolean, now: Date = new Date()): SummaryDayState {
  const total = effectiveDailyGoal(getSettings().dailyGoal);
  const done = getDay(localDayKey(now))?.correct ?? 0;
  const goalMet = done >= total;

  return {
    goalMet,
    stampedToday: goalMet && !stampEarned,
    streakDays: getProgress().streakCurrent,
    done: Math.min(done, total),
    total,
  };
}
