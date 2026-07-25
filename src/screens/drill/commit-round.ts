/**
 * The one write transaction a finished round performs.
 *
 * Everything a round leaves behind lands here, in this order: the SRS state it
 * updated, the parked-round slot it no longer needs, today's day row, and the
 * streak/progress record that day may have stamped. It is kept out of the round
 * hook because it is a transaction rather than lifecycle — sequential storage
 * writes with one derived value feeding the next — and because a wrong order
 * here (folding the day in before reading it back, say) is exactly the kind of
 * bug that only shows up as a streak that grew twice.
 *
 * Called once per finished round; the hook guards against a second call.
 */
import { log } from '@/services/log';
import type { DayRowLike, RoundSummary, SrsState } from '@/session';
import {
  applyAnswersToDay,
  effectiveDailyGoal,
  evaluateStreak,
  isGoalMet,
  localDayKey,
  serializeSrs,
  toGoalVerdicts,
} from '@/session';
import {
  clearRound,
  getDay,
  getProgress,
  getSettings,
  setDay,
  setProgress,
  setSrs,
} from '@/storage';

const NS = 'drill';

/**
 * Persist a finished round and roll it into the day and the streak.
 *
 * @param summary the round as `finishRound` reported it
 * @param srs the round's final SRS state (serialized here, not by the caller)
 * @param now the clock reading that decides which local day this round counts for
 */
export function commitRound(summary: RoundSummary, srs: SrsState, now: Date = new Date()): void {
  setSrs(serializeSrs(srs));
  clearRound();

  const date = localDayKey(now);
  const existing = getDay(date);
  const base: DayRowLike = existing ?? { date, answered: 0, correct: 0, byGroup: {} };
  const day = applyAnswersToDay(base, toGoalVerdicts(summary.verdicts));
  setDay(day);

  const progress = getProgress();
  const streak = evaluateStreak(
    {
      current: progress.streakCurrent,
      best: progress.streakBest,
      lastGoalDate: progress.lastGoalDate,
    },
    date,
    isGoalMet(day, effectiveDailyGoal(getSettings().dailyGoal)),
  );
  setProgress({
    ...progress,
    streakCurrent: streak.current,
    streakBest: streak.best,
    lastGoalDate: streak.lastGoalDate,
    bestCombo: Math.max(progress.bestCombo, summary.bestCombo),
    totalAnswered: progress.totalAnswered + summary.total,
    totalCorrect: progress.totalCorrect + summary.correctCount,
  });

  log.info(NS, 'round summary', {
    modeId: summary.modeId,
    total: summary.total,
    correct: summary.correctCount,
    almost: summary.almostCount,
    wrong: summary.wrongCount,
    points: summary.points,
    bestCombo: summary.bestCombo,
    streak: streak.current,
  });
}
