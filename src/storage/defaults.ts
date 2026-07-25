import { nowIso } from './json';
import type { Progress, Settings } from './types';

export function defaultSettings(): Settings {
  return {
    uiLang: 'ru',
    theme: 'auto',
    rangeMin: 0,
    rangeMax: 100,
    acceptNoAccents: true,
    roundSize: 20,
    speechRate: 'normal',
    dailyGoal: 20,
    soundsEnabled: true,
    lastMode: null,
    onboarded: false,
    updatedAt: nowIso(),
  };
}

export function defaultProgress(): Progress {
  return {
    streakCurrent: 0,
    streakBest: 0,
    lastGoalDate: null,
    bestCombo: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    updatedAt: nowIso(),
  };
}
