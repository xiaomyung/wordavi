export type UiLang = 'ru' | 'en' | 'es';
export type Theme = 'auto' | 'light' | 'dark';
export type RoundSize = 10 | 20 | 30 | 'endless';
export type SpeechRate = 'slow' | 'normal' | 'fast';

export interface Settings {
  uiLang: UiLang;
  theme: Theme;
  rangeMin: number;
  rangeMax: number;
  acceptNoAccents: boolean;
  roundSize: RoundSize;
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

export type StorageObserverKind = 'corrupt' | 'migrated' | 'reset';

export interface StorageObserverEvent {
  key: string;
  kind: StorageObserverKind;
}

export type StorageObserver = (event: StorageObserverEvent) => void;
