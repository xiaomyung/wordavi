import type {
  DayGroupStat,
  DayRow,
  ErrorEntry,
  Progress,
  SavedRound,
  Settings,
  SrsSlot,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T>(value: unknown, options: readonly T[]): value is T {
  return options.includes(value as T);
}

const UI_LANGS = ['ru', 'en', 'es'] as const;
const THEMES = ['auto', 'light', 'dark'] as const;
const ROUND_SIZES = [10, 20, 30, 'endless'] as const;
const SPEECH_RATES = ['slow', 'normal', 'fast'] as const;

export function isSettings(value: unknown): value is Settings {
  if (!isRecord(value)) return false;
  return (
    isOneOf(value.uiLang, UI_LANGS) &&
    isOneOf(value.theme, THEMES) &&
    typeof value.rangeMin === 'number' &&
    typeof value.rangeMax === 'number' &&
    typeof value.acceptNoAccents === 'boolean' &&
    isOneOf(value.roundSize, ROUND_SIZES) &&
    isOneOf(value.speechRate, SPEECH_RATES) &&
    typeof value.dailyGoal === 'number' &&
    typeof value.soundsEnabled === 'boolean' &&
    (value.lastMode === null || typeof value.lastMode === 'string') &&
    typeof value.onboarded === 'boolean' &&
    typeof value.updatedAt === 'string'
  );
}

export function isProgress(value: unknown): value is Progress {
  if (!isRecord(value)) return false;
  return (
    typeof value.streakCurrent === 'number' &&
    typeof value.streakBest === 'number' &&
    (value.lastGoalDate === null || typeof value.lastGoalDate === 'string') &&
    typeof value.bestCombo === 'number' &&
    typeof value.totalAnswered === 'number' &&
    typeof value.totalCorrect === 'number' &&
    typeof value.updatedAt === 'string'
  );
}

function isDayGroupStat(value: unknown): value is DayGroupStat {
  return isRecord(value) && typeof value.answered === 'number' && typeof value.correct === 'number';
}

function isByGroup(value: unknown): value is Record<string, DayGroupStat> {
  return isRecord(value) && Object.values(value).every(isDayGroupStat);
}

function isDayRow(value: unknown): value is DayRow {
  if (!isRecord(value)) return false;
  return (
    typeof value.date === 'string' &&
    typeof value.answered === 'number' &&
    typeof value.correct === 'number' &&
    isByGroup(value.byGroup) &&
    typeof value.updatedAt === 'string'
  );
}

export function isDayRowArray(value: unknown): value is DayRow[] {
  return Array.isArray(value) && value.every(isDayRow);
}

/*
 * The two payload slots below carry a `state` this layer deliberately types
 * `unknown`: its schema belongs to the session layer, which storage may not
 * import. What storage can still insist on is that the payload is a JSON object
 * at all — a string, an array or a number is corruption no reader could ever
 * make sense of, and rejecting it here means a bad slot resets instead of
 * travelling on. The session's own deserializers own everything below that.
 */

export function isSavedRound(value: unknown): value is SavedRound {
  if (!isRecord(value)) return false;
  return (
    typeof value.modeId === 'string' && typeof value.updatedAt === 'string' && isRecord(value.state)
  );
}

export function isSrsSlot(value: unknown): value is SrsSlot {
  if (!isRecord(value)) return false;
  return typeof value.updatedAt === 'string' && isRecord(value.state);
}

function isErrorEntry(value: unknown): value is ErrorEntry {
  if (!isRecord(value)) return false;
  if (typeof value.t !== 'number') return false;
  if (typeof value.message !== 'string') return false;
  if (typeof value.updatedAt !== 'string') return false;
  if ('source' in value && typeof value.source !== 'string') return false;
  if ('stack' in value && typeof value.stack !== 'string') return false;
  return true;
}

export function isErrorEntryArray(value: unknown): value is ErrorEntry[] {
  return Array.isArray(value) && value.every(isErrorEntry);
}
