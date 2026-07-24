import {
  type DayRowLike,
  DISPLAY_GROUP_ORDER,
  DISPLAY_GROUPS,
  type DisplayGroup,
  type SrsState,
} from './types';

export interface GroupStat {
  attempts: number;
  correct: number;
  accuracy: number;
  /** Accuracy over the last-20 ring across the group's buckets (recency-weighted). */
  recentAccuracy: number;
}

export interface MonthStat {
  key: string; // YYYY-MM
  answered: number;
  correct: number;
  accuracy: number;
}

export interface SessionStats {
  groups: Record<DisplayGroup, GroupStat>;
  totals: GroupStat;
  month: MonthStat;
}

function ratio(correct: number, total: number): number {
  return total === 0 ? 0 : correct / total;
}

/**
 * Aggregate display-group stats from the SRS state (lifetime) plus a month
 * accuracy from the day rows. `monthKey` is the caller's local YYYY-MM.
 */
export function computeStats(
  srs: SrsState,
  days: readonly DayRowLike[],
  monthKey: string,
): SessionStats {
  const groups = {} as Record<DisplayGroup, GroupStat>;
  let totalAttempts = 0;
  let totalCorrect = 0;
  let totalRecentOk = 0;
  let totalRecentN = 0;

  for (const group of DISPLAY_GROUP_ORDER) {
    let attempts = 0;
    let correct = 0;
    let recentOk = 0;
    let recentN = 0;
    for (const bucket of DISPLAY_GROUPS[group]) {
      const stat = srs.buckets[bucket];
      if (stat === undefined) continue;
      attempts += stat.attempts;
      correct += stat.correct;
      recentOk += stat.last20.filter((ok) => ok).length;
      recentN += stat.last20.length;
    }
    groups[group] = {
      attempts,
      correct,
      accuracy: ratio(correct, attempts),
      recentAccuracy: ratio(recentOk, recentN),
    };
    totalAttempts += attempts;
    totalCorrect += correct;
    totalRecentOk += recentOk;
    totalRecentN += recentN;
  }

  let monthAnswered = 0;
  let monthCorrect = 0;
  for (const day of days) {
    if (!day.date.startsWith(monthKey)) continue;
    monthAnswered += day.answered;
    monthCorrect += day.correct;
  }

  return {
    groups,
    totals: {
      attempts: totalAttempts,
      correct: totalCorrect,
      accuracy: ratio(totalCorrect, totalAttempts),
      recentAccuracy: ratio(totalRecentOk, totalRecentN),
    },
    month: {
      key: monthKey,
      answered: monthAnswered,
      correct: monthCorrect,
      accuracy: ratio(monthCorrect, monthAnswered),
    },
  };
}
