export type UiLang = 'ru' | 'en' | 'es';
export type Theme = 'auto' | 'light' | 'dark';
/**
 * The round lengths the settings screen offers. Narrower on purpose than the
 * session layer's own `RoundSize` (any positive count or 'endless'), which also
 * has to describe a retry round sized to its miss list.
 */
export type RoundSizeSetting = 10 | 20 | 30 | 'endless';
/** @deprecated Use {@link RoundSizeSetting} — `RoundSize` collides with the session type. */
export type RoundSize = RoundSizeSetting;
export type SpeechRate = 'slow' | 'normal' | 'fast';

export interface Settings {
  uiLang: UiLang;
  theme: Theme;
  rangeMin: number;
  rangeMax: number;
  acceptNoAccents: boolean;
  roundSize: RoundSizeSetting;
  speechRate: SpeechRate;
  dailyGoal: number;
  soundsEnabled: boolean;
  lastMode: string | null;
  onboarded: boolean;
  updatedAt: string;
}

export interface DayGroupStat {
  answered: number;
  correct: number;
}

export interface DayRow {
  date: string;
  answered: number;
  correct: number;
  byGroup: Record<string, DayGroupStat>;
  updatedAt: string;
}

export interface Progress {
  streakCurrent: number;
  streakBest: number;
  lastGoalDate: string | null;
  bestCombo: number;
  totalAnswered: number;
  totalCorrect: number;
  updatedAt: string;
}

export interface SavedRound {
  modeId: string;
  updatedAt: string;
  state: unknown;
}

export interface SrsSlot {
  state: unknown;
  updatedAt: string;
}

export interface ErrorEntry {
  t: number;
  message: string;
  source?: string;
  stack?: string;
  updatedAt: string;
}

/**
 * `writeFailed` means the slot could not be persisted at all (quota exhausted,
 * private-mode storage): the in-memory value the setter returned is still good,
 * but it will not survive a reload.
 */
export type StorageObserverKind = 'corrupt' | 'migrated' | 'reset' | 'writeFailed';

export interface StorageObserverEvent {
  key: string;
  kind: StorageObserverKind;
}

export type StorageObserver = (event: StorageObserverEvent) => void;
