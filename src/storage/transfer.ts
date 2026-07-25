import { getDays } from './days';
import { getErrors } from './errors';
import {
  isDayRowArray,
  isErrorEntryArray,
  isProgress,
  isSavedRound,
  isSettings,
  isSrsSlot,
} from './guards';
import { writeJSON } from './json';
import { STORAGE_KEYS } from './keys';
import { schemaVersion } from './migrations';
import { getProgress } from './progress';
import { removeRawKey, writeRawString } from './raw';
import { getRound } from './round';
import { getSettings } from './settings';
import { getSrs } from './srs';
import type { DayRow, ErrorEntry, Progress, SavedRound, Settings, SrsSlot } from './types';
import { ensureSchemaVersion } from './version';

interface ExportBundle {
  v: number;
  settings: Settings;
  progress: Progress;
  days: DayRow[];
  srs: SrsSlot | null;
  round: SavedRound | null;
  errors: ErrorEntry[];
}

export type ImportResult = { ok: true } | { ok: false; reason: 'parse' | 'version' | 'shape' };

/**
 * Excludes wordavi:log on purpose: it is an ephemeral diagnostic ring owned by
 * the logging service, not user progress, and rebuilds itself each session.
 */
export function exportData(): string {
  ensureSchemaVersion();
  const bundle: ExportBundle = {
    v: schemaVersion,
    settings: getSettings(),
    progress: getProgress(),
    days: getDays(),
    srs: getSrs(),
    round: getRound(),
    errors: getErrors(),
  };
  return JSON.stringify(bundle);
}

function isExportBundle(value: unknown): value is ExportBundle {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.v !== 'number') return false;
  if (!isSettings(record.settings)) return false;
  if (!isProgress(record.progress)) return false;
  if (!isDayRowArray(record.days)) return false;
  if (record.srs !== null && !isSrsSlot(record.srs)) return false;
  if (record.round !== null && !isSavedRound(record.round)) return false;
  if (!isErrorEntryArray(record.errors)) return false;
  return true;
}

export function importData(json: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'parse' };
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as { v?: unknown }).v !== 'number'
  ) {
    return { ok: false, reason: 'shape' };
  }

  const importedVersion = (parsed as { v: number }).v;
  if (importedVersion !== schemaVersion) {
    return { ok: false, reason: 'version' };
  }

  if (!isExportBundle(parsed)) {
    return { ok: false, reason: 'shape' };
  }

  writeRawString(STORAGE_KEYS.v, JSON.stringify(parsed.v));
  writeJSON(STORAGE_KEYS.settings, parsed.settings);
  writeJSON(STORAGE_KEYS.progress, parsed.progress);
  writeJSON(STORAGE_KEYS.days, parsed.days);
  writeJSON(STORAGE_KEYS.errors, parsed.errors);

  if (parsed.srs === null) {
    removeRawKey(STORAGE_KEYS.srs);
  } else {
    writeJSON(STORAGE_KEYS.srs, parsed.srs);
  }

  if (parsed.round === null) {
    removeRawKey(STORAGE_KEYS.round);
  } else {
    writeJSON(STORAGE_KEYS.round, parsed.round);
  }

  return { ok: true };
}
