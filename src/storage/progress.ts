import { defaultProgress } from './defaults';
import { isProgress } from './guards';
import { nowIso, readGuarded, writeJSON } from './json';
import { STORAGE_KEYS } from './keys';
import type { Progress } from './types';
import { ensureSchemaVersion } from './version';

export function getProgress(): Progress {
  ensureSchemaVersion();
  return readGuarded(STORAGE_KEYS.progress, isProgress) ?? defaultProgress();
}

export function setProgress(progress: Progress): Progress {
  ensureSchemaVersion();
  const stamped: Progress = { ...progress, updatedAt: nowIso() };
  writeJSON(STORAGE_KEYS.progress, stamped);
  return stamped;
}

export function updateProgress(patch: Partial<Omit<Progress, 'updatedAt'>>): Progress {
  return setProgress({ ...getProgress(), ...patch });
}
