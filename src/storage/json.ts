import { reportObserver } from './observer';
import { readRawString, writeRawString } from './raw';

export function nowIso(): string {
  return new Date().toISOString();
}

export function writeJSON(key: string, value: unknown): void {
  writeRawString(key, JSON.stringify(value));
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
