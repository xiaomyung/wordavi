import { STORAGE_KEYS } from './keys';
import { migrations, runMigrations, type StorageSnapshot, schemaVersion } from './migrations';
import { reportObserver } from './observer';
import { readRawString, removeRawKey, writeRawString } from './raw';

const DATA_KEYS = [
  STORAGE_KEYS.settings,
  STORAGE_KEYS.srs,
  STORAGE_KEYS.progress,
  STORAGE_KEYS.errors,
  STORAGE_KEYS.log,
  STORAGE_KEYS.round,
  STORAGE_KEYS.days,
] as const;

function readSnapshot(): StorageSnapshot {
  const snapshot: StorageSnapshot = {};
  for (const key of DATA_KEYS) {
    const raw = readRawString(key);
    if (raw === null) continue;
    try {
      snapshot[key] = JSON.parse(raw);
    } catch {
      // drop unreadable entries rather than fail the whole migration
    }
  }
  return snapshot;
}

function writeSnapshot(snapshot: StorageSnapshot): void {
  for (const key of DATA_KEYS) {
    if (!(key in snapshot)) continue;
    writeRawString(key, JSON.stringify(snapshot[key]));
  }
}

function resetAll(): void {
  for (const key of DATA_KEYS) removeRawKey(key);
  writeRawString(STORAGE_KEYS.v, JSON.stringify(schemaVersion));
  reportObserver({ key: STORAGE_KEYS.v, kind: 'reset' });
}

export function ensureSchemaVersion(): void {
  const raw = readRawString(STORAGE_KEYS.v);
  if (raw === null) {
    writeRawString(STORAGE_KEYS.v, JSON.stringify(schemaVersion));
    return;
  }

  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    resetAll();
    return;
  }

  if (
    typeof stored !== 'number' ||
    !Number.isInteger(stored) ||
    stored < 0 ||
    stored > schemaVersion
  ) {
    resetAll();
    return;
  }

  if (stored === schemaVersion) return;

  try {
    const migrated = runMigrations(readSnapshot(), stored, schemaVersion, migrations);
    writeSnapshot(migrated);
    writeRawString(STORAGE_KEYS.v, JSON.stringify(schemaVersion));
    reportObserver({ key: STORAGE_KEYS.v, kind: 'migrated' });
  } catch {
    resetAll();
  }
}

export function initStorage(): void {
  ensureSchemaVersion();
}
