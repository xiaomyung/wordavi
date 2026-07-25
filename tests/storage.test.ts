import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllData,
  clearErrors,
  clearRound,
  exportData,
  getDay,
  getDays,
  getErrors,
  getProgress,
  getRound,
  getSettings,
  getSrs,
  importData,
  pushError,
  runMigrations,
  STORAGE_KEYS,
  type StorageObserverEvent,
  type StorageSnapshot,
  setDay,
  setProgress,
  setRound,
  setSettings,
  setSrs,
  setStorageObserver,
  updateSettings,
} from '@/storage';

describe('storage', () => {
  let events: StorageObserverEvent[];

  beforeEach(() => {
    localStorage.clear();
    events = [];
    setStorageObserver((event) => events.push(event));
  });

  describe('settings', () => {
    it('returns defaults when missing', () => {
      const settings = getSettings();
      expect(settings).toMatchObject({
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
      });
      expect(events).toEqual([]);
    });

    it('returns defaults and reports corruption on bad JSON', () => {
      localStorage.setItem(STORAGE_KEYS.settings, '{not json');
      const settings = getSettings();
      expect(settings.uiLang).toBe('ru');
      expect(events).toContainEqual({ key: STORAGE_KEYS.settings, kind: 'corrupt' });
    });

    it('returns defaults and reports corruption on a wrong shape', () => {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ uiLang: 'fr' }));
      const settings = getSettings();
      expect(settings.uiLang).toBe('ru');
      expect(events).toContainEqual({ key: STORAGE_KEYS.settings, kind: 'corrupt' });
    });

    it('stamps updatedAt on write', () => {
      const written = setSettings({ ...getSettings(), dailyGoal: 30 });
      expect(written.dailyGoal).toBe(30);
      expect(Number.isNaN(Date.parse(written.updatedAt))).toBe(false);
    });

    it('updateSettings merges a partial patch', () => {
      updateSettings({ dailyGoal: 45 });
      const settings = getSettings();
      expect(settings.dailyGoal).toBe(45);
      expect(settings.uiLang).toBe('ru');
    });

    it('reports writeFailed when the slot cannot be persisted (quota)', () => {
      const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      try {
        // The caller still gets its record back — only persistence failed.
        const written = setSettings({ ...getSettings(), dailyGoal: 30 });
        expect(written.dailyGoal).toBe(30);
        expect(events).toContainEqual({ key: STORAGE_KEYS.settings, kind: 'writeFailed' });
      } finally {
        setItem.mockRestore();
      }
    });
  });

  describe('progress', () => {
    it('returns defaults when missing', () => {
      const progress = getProgress();
      expect(progress).toMatchObject({
        streakCurrent: 0,
        streakBest: 0,
        lastGoalDate: null,
        bestCombo: 0,
        totalAnswered: 0,
        totalCorrect: 0,
      });
    });

    it('returns defaults and reports corruption on a wrong shape', () => {
      localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify({ streakCurrent: 'nope' }));
      const progress = getProgress();
      expect(progress.streakCurrent).toBe(0);
      expect(events).toContainEqual({ key: STORAGE_KEYS.progress, kind: 'corrupt' });
    });

    it('stamps updatedAt on write', () => {
      const written = setProgress({ ...getProgress(), streakCurrent: 5 });
      expect(written.streakCurrent).toBe(5);
      expect(Number.isNaN(Date.parse(written.updatedAt))).toBe(false);
    });
  });

  describe('days', () => {
    it('is empty by default', () => {
      expect(getDays()).toEqual([]);
    });

    it('upserts by date, stays sorted, and overwrites same-day rows', () => {
      setDay({ date: '2026-07-20', answered: 5, correct: 4, byGroup: {} });
      setDay({ date: '2026-07-18', answered: 2, correct: 2, byGroup: {} });
      setDay({ date: '2026-07-20', answered: 8, correct: 6, byGroup: {} });

      const days = getDays();
      expect(days.map((day) => day.date)).toEqual(['2026-07-18', '2026-07-20']);
      expect(getDay('2026-07-20')?.answered).toBe(8);
    });
  });

  describe('srs', () => {
    it('is null by default', () => {
      expect(getSrs()).toBeNull();
    });

    it('round-trips an opaque state blob', () => {
      setSrs({ buckets: { units: 3 } });
      expect(getSrs()?.state).toEqual({ buckets: { units: 3 } });
    });

    it('reports corruption and returns null on a wrong shape', () => {
      localStorage.setItem(STORAGE_KEYS.srs, JSON.stringify({ nope: true }));
      expect(getSrs()).toBeNull();
      expect(events).toContainEqual({ key: STORAGE_KEYS.srs, kind: 'corrupt' });
    });

    it('rejects a payload that is not a JSON object at all', () => {
      for (const state of ['blob', 42, ['a'], null]) {
        localStorage.setItem(STORAGE_KEYS.srs, JSON.stringify({ state, updatedAt: 'now' }));
        expect(getSrs(), JSON.stringify(state)).toBeNull();
      }
    });
  });

  describe('round', () => {
    it('is null by default, round-trips, and clears', () => {
      expect(getRound()).toBeNull();
      setRound('drill', { index: 3 });
      expect(getRound()).toMatchObject({ modeId: 'drill', state: { index: 3 } });
      clearRound();
      expect(getRound()).toBeNull();
    });

    it('rejects a payload that is not a JSON object at all', () => {
      for (const state of ['blob', 42, ['a'], null]) {
        localStorage.setItem(
          STORAGE_KEYS.round,
          JSON.stringify({ modeId: 'drill', state, updatedAt: 'now' }),
        );
        expect(getRound(), JSON.stringify(state)).toBeNull();
      }
    });
  });

  describe('errors', () => {
    it('caps the ring buffer at 50 entries, dropping the oldest', () => {
      for (let i = 0; i < 55; i += 1) {
        pushError({ t: i, message: `err-${i}` });
      }
      const errors = getErrors();
      expect(errors).toHaveLength(50);
      expect(errors[0]?.message).toBe('err-5');
      expect(errors[49]?.message).toBe('err-54');
    });

    it('clearErrors empties the buffer', () => {
      pushError({ t: 1, message: 'boom' });
      clearErrors();
      expect(getErrors()).toEqual([]);
    });
  });

  describe('schema version handling', () => {
    it('treats a missing version as a fresh install', () => {
      getSettings();
      expect(localStorage.getItem(STORAGE_KEYS.v)).toBe('1');
      expect(events).toEqual([]);
    });

    it('wipes everything to defaults on unreadable version JSON', () => {
      localStorage.setItem(STORAGE_KEYS.v, 'not-json');
      localStorage.setItem(
        STORAGE_KEYS.settings,
        JSON.stringify({ uiLang: 'en', updatedAt: '2020-01-01T00:00:00.000Z' }),
      );

      const settings = getSettings();
      expect(settings.uiLang).toBe('ru');
      expect(localStorage.getItem(STORAGE_KEYS.v)).toBe('1');
      expect(events).toContainEqual({ key: STORAGE_KEYS.v, kind: 'reset' });
    });

    it('wipes everything to defaults on a from-the-future version', () => {
      localStorage.setItem(STORAGE_KEYS.v, JSON.stringify(99));
      getSettings();
      expect(events).toContainEqual({ key: STORAGE_KEYS.v, kind: 'reset' });
    });
  });

  describe('migration runner', () => {
    it('applies migrations in sequential order', () => {
      const steps: Record<number, (raw: StorageSnapshot) => StorageSnapshot> = {
        1: (raw) => ({ ...raw, a: 1 }),
        2: (raw) => ({ ...raw, b: (raw.a as number) + 1 }),
        3: (raw) => ({ ...raw, c: (raw.b as number) + 1 }),
      };
      const result = runMigrations({}, 1, 4, steps);
      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('throws when a step is missing so the caller can fall back to a reset', () => {
      expect(() => runMigrations({}, 1, 3, { 1: (raw) => raw })).toThrow();
    });
  });

  describe('reset', () => {
    it('removes every wordavi key', () => {
      setSettings({ ...getSettings(), dailyGoal: 33 });
      setProgress({ ...getProgress(), streakCurrent: 4 });
      setDay({ date: '2026-07-25', answered: 3, correct: 3, byGroup: {} });
      setSrs({ buckets: { units: 1 } });
      setRound('drill', { index: 2 });
      pushError({ t: 1, message: 'boom' });
      expect(localStorage.getItem(STORAGE_KEYS.settings)).not.toBeNull();

      clearAllData();

      const leftovers: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key?.startsWith('wordavi:')) leftovers.push(key);
      }
      expect(leftovers).toEqual([]);
      for (const key of Object.values(STORAGE_KEYS)) {
        expect(localStorage.getItem(key)).toBeNull();
      }
    });

    it('leaves defaults behind for the next read', () => {
      setSettings({ ...getSettings(), dailyGoal: 33 });
      clearAllData();
      expect(getSettings().dailyGoal).toBe(20);
      expect(getProgress().streakCurrent).toBe(0);
    });
  });

  describe('export and import', () => {
    it('round-trips all owned data through export then import', () => {
      setSettings({ ...getSettings(), dailyGoal: 33 });
      setProgress({ ...getProgress(), streakCurrent: 7 });
      setDay({
        date: '2026-07-20',
        answered: 3,
        correct: 2,
        byGroup: { units: { answered: 3, correct: 2 } },
      });
      setSrs({ buckets: { units: 1 } });
      setRound('drill', { index: 2 });
      pushError({ t: 1, message: 'boom' });

      const json = exportData();
      localStorage.clear();

      expect(importData(json)).toEqual({ ok: true });
      expect(getSettings().dailyGoal).toBe(33);
      expect(getProgress().streakCurrent).toBe(7);
      expect(getDays()).toHaveLength(1);
      expect(getSrs()?.state).toEqual({ buckets: { units: 1 } });
      expect(getRound()?.modeId).toBe('drill');
      expect(getErrors()).toHaveLength(1);
    });

    it('rejects invalid JSON without touching storage', () => {
      const before = setSettings({ ...getSettings(), dailyGoal: 41 });
      const result = importData('not json');
      expect(result).toEqual({ ok: false, reason: 'parse' });
      expect(getSettings()).toEqual(before);
    });

    it('rejects a mismatched schema version without touching storage', () => {
      const before = setSettings({ ...getSettings(), dailyGoal: 41 });
      const bundle = JSON.parse(exportData()) as Record<string, unknown>;
      bundle.v = 999;
      const result = importData(JSON.stringify(bundle));
      expect(result).toEqual({ ok: false, reason: 'version' });
      expect(getSettings()).toEqual(before);
    });

    it('rejects a broken shape without touching storage', () => {
      const before = setSettings({ ...getSettings(), dailyGoal: 41 });
      const bundle = JSON.parse(exportData()) as Record<string, unknown>;
      bundle.settings = { uiLang: 'fr' };
      const result = importData(JSON.stringify(bundle));
      expect(result).toEqual({ ok: false, reason: 'shape' });
      expect(getSettings()).toEqual(before);
    });
  });
});
