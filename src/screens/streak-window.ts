/**
 * Loyalty-card streak window shared by the home and stats screens.
 *
 * Both mockups (screens/home.html `.strow`, screens/stats.html `.stamps`) draw
 * the same seven circles with today fourth: three past days, today, three still
 * ahead. Days that missed their goal render as plain empty circles — the design
 * rule is "missed days stay empty (no flames, no red, no guilt copy)".
 */
import type { StreakStampDay } from '@/components';
import { type DayRowLike, isGoalMet, shiftDayKey } from '@/session';

/** Seven stamps per row, today at index 3. */
export const STREAK_WINDOW_DAYS = 7;
export const STREAK_WINDOW_PAST = 3;

/**
 * Build the seven-stamp window ending three days after `today`. A day is
 * stamped once its counted answers reach the daily goal; today is dashed until
 * then; every other unstamped day is an empty circle.
 */
export function buildStreakWindow(
  days: readonly DayRowLike[],
  dailyGoal: number,
  today: string,
): StreakStampDay[] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const window: StreakStampDay[] = [];

  for (let index = 0; index < STREAK_WINDOW_DAYS; index += 1) {
    const key = shiftDayKey(today, index - STREAK_WINDOW_PAST);
    const row = byDate.get(key);
    const met = row !== undefined && isGoalMet(row, dailyGoal);
    window.push({
      seedKey: key,
      state: met ? 'done' : key === today ? 'today' : 'future',
    });
  }

  return window;
}
