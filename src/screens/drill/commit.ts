/**
 * The two write transactions a drill performs: one per answer, one at the end.
 *
 * They are kept out of the round hook because they are transactions rather than
 * lifecycle — sequential storage writes with one derived value feeding the next —
 * and because a wrong order here (folding the day in before reading it back, say)
 * is exactly the kind of bug that only shows up as a streak that grew twice.
 */
import { log } from '@/services/log';
import type { AnswerRecord, DayRowLike, RoundSummary, Score, SrsState } from '@/session';
import {
  applyAnswersToDay,
  countsAsCorrect,
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
 * Fold one graded answer into today's row, the running totals and the streak.
 *
 * Per answer rather than per finished round: leaving a round part-played is the
 * ordinary way to use a mode row — the home screen offers "continue · 6 of 20"
 * for exactly that — and a daily goal that only moved when a round reached its
 * last question showed nothing at all for an afternoon of practice.
 *
 * @param record the answer as `answerQuestion` graded it
 * @param score the round's score *after* that answer (its best combo is a total)
 * @param now the clock reading that decides which local day the answer counts for
 * @returns whether this is the answer that met today's goal. The summary card has
 *   no other way to know: it reads the day row after the fact, by which time a
 *   stamp earned by this round and one carried in from earlier today look alike.
 */
export function commitAnswer(record: AnswerRecord, score: Score, now: Date = new Date()): boolean {
  const date = localDayKey(now);
  const goal = effectiveDailyGoal(getSettings().dailyGoal);
  const base: DayRowLike = getDay(date) ?? { date, answered: 0, correct: 0, byGroup: {} };
  const metBefore = isGoalMet(base, goal);
  const day = applyAnswersToDay(base, toGoalVerdicts([record]));
  setDay(day);
  const metAfter = isGoalMet(day, goal);

  const progress = getProgress();
  const streak = evaluateStreak(
    {
      current: progress.streakCurrent,
      best: progress.streakBest,
      lastGoalDate: progress.lastGoalDate,
    },
    date,
    metAfter,
  );
  setProgress({
    ...progress,
    streakCurrent: streak.current,
    streakBest: streak.best,
    lastGoalDate: streak.lastGoalDate,
    bestCombo: Math.max(progress.bestCombo, score.bestCombo),
    totalAnswered: progress.totalAnswered + 1,
    totalCorrect: progress.totalCorrect + (countsAsCorrect(record.verdict) ? 1 : 0),
  });

  return !metBefore && metAfter;
}

/**
 * Close the books on a finished round: its final SRS state, and the parked slot
 * it no longer needs. The day, the totals and the streak are already up to date —
 * {@link commitAnswer} wrote each of them as the answer was given.
 *
 * Called once per finished round; the hook guards against a second call.
 */
export function commitRound(summary: RoundSummary, srs: SrsState): void {
  setSrs(serializeSrs(srs));
  clearRound();

  log.info(NS, 'round summary', {
    modeId: summary.modeId,
    total: summary.total,
    correct: summary.correctCount,
    almost: summary.almostCount,
    wrong: summary.wrongCount,
    points: summary.points,
    bestCombo: summary.bestCombo,
    streak: getProgress().streakCurrent,
  });
}
