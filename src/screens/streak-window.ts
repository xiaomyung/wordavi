/**
 * Loyalty-card streak window shared by the home and stats screens.
 *
 * Both mockups (screens/home.html `.strow`, screens/stats.html `.stamps`) draw
 * the same seven circles with today fourth: three past days, today, three still
 * ahead. Days that missed their goal render as plain empty circles — the design
 * rule is "missed days stay empty (no flames, no red, no guilt copy)".
 */
import type { StreakStampDay } from '@/components';
import { type DayRowLike, isGoalMet } from '@/session';

/** Seven stamps per row, today at index 3. */
export const STREAK_WINDOW_DAYS = 7;
export const STREAK_WINDOW_PAST = 3;

const DAY_MS = 86_400_000;

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
