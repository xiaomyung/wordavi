import { isSrsSlot } from './guards';
import { nowIso, readGuarded, writeJSON } from './json';
import { STORAGE_KEYS } from './keys';
import type { SrsSlot } from './types';
import { ensureSchemaVersion } from './version';

export function getSrs(): SrsSlot | null {
  ensureSchemaVersion();
  return readGuarded(STORAGE_KEYS.srs, isSrsSlot);
}

export function setSrs(state: unknown): SrsSlot {
  ensureSchemaVersion();
  const slot: SrsSlot = { state, updatedAt: nowIso() };
  writeJSON(STORAGE_KEYS.srs, slot);
  return slot;
}
