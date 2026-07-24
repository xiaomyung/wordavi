import { isSavedRound } from './guards';
import { nowIso, readGuarded, writeJSON } from './json';
import { STORAGE_KEYS } from './keys';
import { removeRawKey } from './raw';
import type { SavedRound } from './types';
import { ensureSchemaVersion } from './version';

export function getRound(): SavedRound | null {
  ensureSchemaVersion();
  return readGuarded(STORAGE_KEYS.round, isSavedRound);
}

export function setRound(modeId: string, state: unknown): SavedRound {
  ensureSchemaVersion();
  const round: SavedRound = { modeId, state, updatedAt: nowIso() };
  writeJSON(STORAGE_KEYS.round, round);
  return round;
}

export function clearRound(): void {
  ensureSchemaVersion();
  removeRawKey(STORAGE_KEYS.round);
}
