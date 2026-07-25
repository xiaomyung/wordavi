import { reportObserver } from './observer';
import { readRawString, writeRawString } from './raw';

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Persist a slot. Returns false when the write was refused (quota exhausted,
 * storage unavailable) and reports it to the observer, so a caller that cares
 * can tell "saved" from "kept in memory only".
 */
export function writeJSON(key: string, value: unknown): boolean {
  const written = writeRawString(key, JSON.stringify(value));
  if (!written) reportObserver({ key, kind: 'writeFailed' });
  return written;
}

export function readGuarded<T>(key: string, guard: (value: unknown) => value is T): T | null {
  const raw = readRawString(key);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    reportObserver({ key, kind: 'corrupt' });
    return null;
  }

  if (!guard(parsed)) {
    reportObserver({ key, kind: 'corrupt' });
    return null;
  }

  return parsed;
}
