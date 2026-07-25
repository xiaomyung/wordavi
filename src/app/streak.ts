/**
 * The streak numbers the dashboards print, read against today's calendar date.
 *
 * `progress.streakCurrent` is only ever written when a day earns its stamp, so
 * between stamps it is a claim about the past: a learner who met the goal a week
 * ago and opens the app before playing would otherwise be shown a run the
 * calendar has already ended. `settleStreak` derives that from `lastGoalDate`,
 * and reading it here — once, on the way into the screens — is what keeps home
 * and stats from ever disagreeing about the same run. The round summary needs no
 * settling of its own: `commitRound` has already settled and stored the run by
 * the time it is sampled.
 *
 * The reading is deliberately not written back. A lapse follows from
 * `lastGoalDate` on every read, and `commitRound` settles before it stamps, so
 * storage catches up the moment a round is played; persisting a zero on app open
 * would buy nothing and would let a device with a wrong clock destroy a real run
 * for good. `lastGoalDate` and `streakBest` stay the record of what happened.
 */
import { localDayKey, settleStreak } from '@/session';
import { getProgress } from '@/storage';

/** The two streak numbers a screen shows: the live run and the lifetime record. */
export interface SettledStreak {
  current: number;
  best: number;
}

/**
 * @param now the clock reading that decides which local day the run is measured against
 */
export function settledStreak(now: Date = new Date()): SettledStreak {
  const progress = getProgress();
  const { current, best } = settleStreak(
    {
      current: progress.streakCurrent,
      best: progress.streakBest,
      lastGoalDate: progress.lastGoalDate,
    },
    localDayKey(now),
  );
  return { current, best };
}
