import { defaultSettings } from './defaults';
import { isSettings } from './guards';
import { nowIso, readGuarded, writeJSON } from './json';
import { STORAGE_KEYS } from './keys';
import type { Settings } from './types';
import { ensureSchemaVersion } from './version';

export function getSettings(): Settings {
  ensureSchemaVersion();
  return readGuarded(STORAGE_KEYS.settings, isSettings) ?? defaultSettings();
}

export function setSettings(settings: Settings): Settings {
  ensureSchemaVersion();
  const stamped: Settings = { ...settings, updatedAt: nowIso() };
  writeJSON(STORAGE_KEYS.settings, stamped);
  return stamped;
}

export function updateSettings(patch: Partial<Omit<Settings, 'updatedAt'>>): Settings {
  return setSettings({ ...getSettings(), ...patch });
}
