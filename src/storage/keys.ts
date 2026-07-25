export const STORAGE_KEYS = {
  v: 'wordavi:v',
  settings: 'wordavi:settings',
  srs: 'wordavi:srs',
  progress: 'wordavi:progress',
  errors: 'wordavi:errors',
  log: 'wordavi:log',
  round: 'wordavi:round',
  days: 'wordavi:days',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
