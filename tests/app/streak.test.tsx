import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import { settledStreak } from '@/app/streak';
import { init as initI18n } from '@/i18n';
import { localDayKey, shiftDayKey } from '@/session';
import { getProgress, setDay, updateProgress, updateSettings } from '@/storage';

/** Home carries an install invitation; the quiet default keeps it out of the way. */
const installBus = vi.hoisted(() => ({ listeners: new Set<() => void>() }));

vi.mock('@/services/install', async () => {
  const { installMock } = await import('../helpers/mocks');
  return installMock(installBus);
});

const NOW = new Date(2026, 6, 25, 9, 0, 0);
const TODAY = '2026-07-25';
const YESTERDAY = '2026-07-24';

/** A run of seven days, last stamped on `lastGoalDate`. */
function seedStreak(lastGoalDate: string | null, current = 7, best = 7): void {
  updateProgress({
    streakCurrent: current,
    streakBest: best,
    lastGoalDate,
    bestCombo: 5,
    totalAnswered: 200,
    totalCorrect: 180,
  });
}

beforeEach(() => {
  localStorage.clear();
  installBus.listeners.clear();
});

describe('settledStreak', () => {
  it('keeps a run whose goal was met today', () => {
    seedStreak(TODAY);
    expect(settledStreak(NOW)).toEqual({ current: 7, best: 7 });
  });

  it('keeps a run whose goal was met yesterday — today is still winnable', () => {
    seedStreak(YESTERDAY);
    expect(settledStreak(NOW)).toEqual({ current: 7, best: 7 });
  });

  it('ends a run whose last goal is older than yesterday', () => {
    seedStreak(shiftDayKey(TODAY, -2));
    expect(settledStreak(NOW)).toEqual({ current: 0, best: 7 });
  });

  it('reads zero for a learner with no history at all', () => {
    expect(settledStreak(NOW)).toEqual({ current: 0, best: 0 });
  });

  it('never lowers the record when the run ends', () => {
    seedStreak(shiftDayKey(TODAY, -30), 3, 11);
    expect(settledStreak(NOW)).toEqual({ current: 0, best: 11 });
  });

  it('keeps a run stamped ahead of today: the clock moved, the learner did nothing wrong', () => {
    seedStreak(shiftDayKey(TODAY, 1), 4, 9);
    expect(settledStreak(NOW)).toEqual({ current: 4, best: 9 });
  });

  it('measures the gap on local calendar days, not elapsed hours', () => {
    seedStreak(localDayKey(new Date(2026, 6, 24, 0, 5)));
    // Just short of two full days later, but the next calendar day: still alive.
    expect(settledStreak(new Date(2026, 6, 25, 23, 55)).current).toBe(7);
    // Barely over one day later, but two calendar days on: over.
    expect(settledStreak(new Date(2026, 6, 26, 0, 10)).current).toBe(0);
  });

  it('measures the run against the system clock when no reading is passed', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(NOW);
      seedStreak(YESTERDAY);
      expect(settledStreak().current).toBe(7);

      vi.setSystemTime(new Date(2026, 6, 28, 9, 0, 0));
      expect(settledStreak().current).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reads without writing: a lapse is the calendar’s, not a stored fact', () => {
    seedStreak(shiftDayKey(TODAY, -4));
    const before = getProgress();

    expect(settledStreak(NOW).current).toBe(0);

    // Byte-identical, `updatedAt` included: nothing about the record was touched,
    // so a wrong device clock can never destroy a run that is still running.
    expect(getProgress()).toEqual(before);
  });
});

/**
 * The screens print what the app settles, so the numbers are asserted through a
 * real navigation rather than by handing the screens their props directly.
 */
describe('settled streak on the dashboards', () => {
  /** Today's key from the real clock: what the app itself will read on render. */
  const today = localDayKey(new Date());

  beforeEach(() => {
    initI18n({ initialLang: 'en' });
    updateSettings({ onboarded: true, dailyGoal: 20 });
  });

  function openStats(): void {
    fireEvent.click(screen.getByRole('button', { name: 'Stats' }));
  }

  it('shows a live run on home and on stats', () => {
    seedStreak(shiftDayKey(today, -1));
    setDay({ date: shiftDayKey(today, -1), answered: 24, correct: 22, byGroup: {} });
    render(<App />);

    expect(screen.getByText('7 days')).toBeInTheDocument();

    openStats();
    expect(screen.getByText(/in a row/)).toHaveTextContent(/^7 days in a row/);
    expect(screen.getByText(/^record/)).toHaveTextContent(/7 days/);
  });

  it('shows no run once the calendar has ended it, before anything is played', () => {
    seedStreak(shiftDayKey(today, -3));
    setDay({ date: shiftDayKey(today, -3), answered: 24, correct: 22, byGroup: {} });
    render(<App />);

    expect(screen.getByText('0 days')).toBeInTheDocument();
    expect(screen.queryByText('7 days')).not.toBeInTheDocument();

    openStats();
    expect(screen.getByText(/in a row/)).toHaveTextContent(/^0 days in a row/);
    // The record is what happened, and it happened: only the run is over.
    expect(screen.getByText(/^record/)).toHaveTextContent(/7 days/);
  });

  it('leaves the stored run alone while it says so', () => {
    seedStreak(shiftDayKey(today, -3));
    render(<App />);
    openStats();

    expect(getProgress()).toMatchObject({
      streakCurrent: 7,
      streakBest: 7,
      lastGoalDate: shiftDayKey(today, -3),
    });
  });
});
