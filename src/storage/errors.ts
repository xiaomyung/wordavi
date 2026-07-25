import { isErrorEntryArray } from './guards';
import { nowIso, readGuarded, writeJSON } from './json';
import { STORAGE_KEYS } from './keys';
import type { ErrorEntry } from './types';
import { ensureSchemaVersion } from './version';

const ERROR_CAP = 50;

export function getErrors(): ErrorEntry[] {
  ensureSchemaVersion();
  return readGuarded(STORAGE_KEYS.errors, isErrorEntryArray) ?? [];
}

export function pushError(entry: Omit<ErrorEntry, 'updatedAt'>): ErrorEntry {
  ensureSchemaVersion();
  const stamped: ErrorEntry = { ...entry, updatedAt: nowIso() };
  const next = [...getErrors(), stamped].slice(-ERROR_CAP);
  writeJSON(STORAGE_KEYS.errors, next);
  return stamped;
}

export function clearErrors(): void {
  ensureSchemaVersion();
  writeJSON(STORAGE_KEYS.errors, []);
}
