import { isDayRowArray } from './guards';
import { nowIso, readGuarded, writeJSON } from './json';
import { STORAGE_KEYS } from './keys';
import type { DayRow } from './types';
import { ensureSchemaVersion } from './version';

const MAX_DAYS = 400;

export function getDays(): DayRow[] {
  ensureSchemaVersion();
  return readGuarded(STORAGE_KEYS.days, isDayRowArray) ?? [];
}

export function getDay(date: string): DayRow | undefined {
  return getDays().find((day) => day.date === date);
}

export function setDay(day: Omit<DayRow, 'updatedAt'>): DayRow {
  ensureSchemaVersion();
  const stamped: DayRow = { ...day, updatedAt: nowIso() };
  const next = getDays()
    .filter((existing) => existing.date !== stamped.date)
    .concat(stamped)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_DAYS);
  writeJSON(STORAGE_KEYS.days, next);
  return stamped;
}
