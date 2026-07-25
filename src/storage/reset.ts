import { STORAGE_KEYS } from './keys';
import { removeRawKey } from './raw';

/**
 * Removes every `wordavi:*` key: settings, srs, progress, errors, log, round,
 * days and the schema version marker. Deliberately blunt — the point is that
 * nothing of the user survives.
 *
 * Callers are expected to reload straight after. Several modules cache
 * storage-backed state in memory (the log ring buffer, the app's screen state,
 * the settings a screen already read), and only a fresh boot is guaranteed to
 * come back with the defaults.
 */
export function clearAllData(): void {
  for (const key of Object.values(STORAGE_KEYS)) removeRawKey(key);
}
