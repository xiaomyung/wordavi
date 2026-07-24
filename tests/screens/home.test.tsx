import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n, { init } from '@/i18n';
import type { HomeModeItem, HomeScreenProps } from '@/screens/HomeScreen';
import { HomeScreen, savedRoundProgress } from '@/screens/HomeScreen';
import type { AnswerRecord, RoundSerialized, RoundSize } from '@/session';
import type { SavedRound } from '@/storage';
import { getSettings, setDay, setRound, setSettings, updateProgress } from '@/storage';

/** Friday 24 July 2026, 09:00 local — the date the home mockup renders. */
const MORNING = new Date(2026, 6, 24, 9, 0, 0);
const TODAY = '2026-07-24';

const MODES: readonly HomeModeItem[] = [
  {
    id: 'words',
    title: 'Число → словами',
    example: '475 → cuatrocientos setenta y cinco',
    status: 'ok',
  },
  {
    id: 'listen',
    title: 'На слух',
    example: 'услышать и ввести цифрами',
    status: 'paused-offline',
  },
  {
    id: 'speak',
    title: 'Скажите вслух',
    example: 'произношение · микрофон',
    status: 'paused-voice',
  },
];

function renderHome(overrides: Partial<HomeScreenProps> = {}): HomeScreenProps {
  const props: HomeScreenProps = {
    modes: MODES,
    onStartMode: vi.fn(),
    onResume: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenStats: vi.fn(),
    ...overrides,
  };
  render(<HomeScreen {...props} />);
  return props;
}

function answerRecord(index: number): AnswerRecord {
  return {
    questionId: `q${index}`,
    bucket: 'd0_15',
    given: 'cinco',
    verdict: 'correct',
    fromWrongQueue: false,
  };
}

function serializedRound(
  done: number,
  size: RoundSize,
  extra: Partial<RoundSerialized> = {},
): RoundSerialized {
  return {
    version: 1,
    config: { modeId: 'words', size, rangeMin: 0, rangeMax: 100, seed: 7 },
    rngDraws: 0,
    step: done,
    served: [],
    records: Array.from({ length: done }, (_unused, index) => answerRecord(index)),
    score: { points: 0, combo: 0, bestCombo: 0 },
    lastWrongQueueStep: -3,
    finished: false,
    retry: false,
    retryItems: [],
    ...extra,
  };
}

function seedDay(correct: number, answered = correct): void {
  setDay({ date: TODAY, answered, correct, byGroup: {} });
}

beforeAll(() => {
  init({ initialLang: 'ru' });
});

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(MORNING);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('HomeScreen greeting', () => {
  it.each([
    [6, 'Доброе утро!'],
    [11, 'Доброе утро!'],
    [12, 'Добрый день!'],
    [17, 'Добрый день!'],
    [18, 'Добрый вечер!'],
    [23, 'Добрый вечер!'],
    [3, 'Добрый вечер!'],
  ])('greets by the local hour (%i:00)', (hour, greeting) => {
    vi.setSystemTime(new Date(2026, 6, 24, hour, 0, 0));
    renderHome();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(greeting);
  });

  it('prints the localized date line under the greeting', () => {
    renderHome();
    expect(screen.getByText(/24 июля/)).toBeInTheDocument();
    expect(screen.getByText(/пятница/i)).toBeInTheDocument();
  });
});

describe('HomeScreen daily goal', () => {
  it('rings today’s counted answers against the daily goal', () => {
    setSettings({ ...getSettings(), dailyGoal: 20 });
    seedDay(12, 15);
    renderHome();

    expect(screen.getByText('Дневная цель')).toBeInTheDocument();
    expect(screen.getByText('12 из 20 — почти!')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '60%' })).toBeInTheDocument();
  });

  it('stays factual well below the goal', () => {
    setSettings({ ...getSettings(), dailyGoal: 20 });
    seedDay(2, 4);
    renderHome();
    expect(screen.getByText('2 из 20')).toBeInTheDocument();
  });
});

describe('HomeScreen streak plurals', () => {
  it.each([
    [1, '1 день'],
    [2, '2 дня'],
    [3, '3 дня'],
    [5, '5 дней'],
    [11, '11 дней'],
    [21, '21 день'],
    [0, '0 дней'],
  ])('declines the Russian day count (%i)', (count, expected) => {
    expect(i18n.t('home.streak_n', { count })).toBe(expected);
  });

  it.each([
    [1, '1 день'],
    [3, '3 дня'],
    [5, '5 дней'],
  ])('renders the streak label with the right plural form (%i)', (streak, expected) => {
    updateProgress({
      streakCurrent: streak,
      streakBest: streak,
      lastGoalDate: null,
      bestCombo: 0,
      totalAnswered: 40,
      totalCorrect: 30,
    });
    renderHome();
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});

describe('HomeScreen round CTA', () => {
  it('offers to resume with "N of M" when a round is parked', () => {
    setRound('words', serializedRound(12, 30));
    const props = renderHome();

    const cta = screen.getByRole('button', { name: 'Продолжить · 12 из 30' });
    fireEvent.click(cta);
    expect(props.onResume).toHaveBeenCalledTimes(1);
    expect(props.onStartMode).not.toHaveBeenCalled();
  });

  it('shows the endless marker instead of a question count', () => {
    setRound('words', serializedRound(7, 'endless'));
    renderHome();
    expect(screen.getByRole('button', { name: 'Продолжить · 7 из ∞' })).toBeInTheDocument();
  });

  it('starts the first round for a learner with no history', () => {
    const props = renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Начать первый раунд' }));
    expect(props.onStartMode).toHaveBeenCalledWith('words');
  });

  it('starts the last played mode once there is history', () => {
    setSettings({ ...getSettings(), lastMode: 'grocery' });
    updateProgress({
      streakCurrent: 1,
      streakBest: 1,
      lastGoalDate: TODAY,
      bestCombo: 3,
      totalAnswered: 60,
      totalCorrect: 50,
    });
    const props = renderHome();

    fireEvent.click(screen.getByRole('button', { name: 'Начать раунд' }));
    expect(props.onStartMode).toHaveBeenCalledWith('grocery');
  });

  it('never resumes a finished round', () => {
    setRound('words', serializedRound(30, 30, { finished: true }));
    renderHome();
    expect(screen.queryByRole('button', { name: /Продолжить/ })).not.toBeInTheDocument();
  });
});

describe('savedRoundProgress', () => {
  it('returns null without a slot, for junk, and for a finished round', () => {
    expect(savedRoundProgress(null)).toBeNull();
    const junk: SavedRound = { modeId: 'words', updatedAt: 'now', state: { nope: true } };
    expect(savedRoundProgress(junk)).toBeNull();
    const finished: SavedRound = {
      modeId: 'words',
      updatedAt: 'now',
      state: serializedRound(30, 30, { finished: true }),
    };
    expect(savedRoundProgress(finished)).toBeNull();
  });

  it('reports the retry length as the total for a retry round', () => {
    const saved: SavedRound = {
      modeId: 'words',
      updatedAt: 'now',
      state: serializedRound(1, 4, {
        retry: true,
        retryItems: [
          {
            id: 'a',
            bucket: 'd0_15',
            prompt: { kind: 'number', value: 5 },
            accepted: { intVal: 5 },
          },
          {
            id: 'b',
            bucket: 'd0_15',
            prompt: { kind: 'number', value: 6 },
            accepted: { intVal: 6 },
          },
        ],
      }),
    };
    expect(savedRoundProgress(saved)).toEqual({ done: 1, total: 2 });
  });
});

describe('HomeScreen mode list', () => {
  it('starts a mode from an available row', () => {
    const props = renderHome();
    fireEvent.click(screen.getByRole('button', { name: /Число → словами/ }));
    expect(props.onStartMode).toHaveBeenCalledWith('words');
  });

  it('keeps paused rows inert and explains them with a chip and a toast', async () => {
    const { getToast, dismissToast } = await import('@/services/toast');
    const props = renderHome();

    const offlineRow = screen.getByRole('button', { name: /На слух/ });
    expect(offlineRow).toHaveAttribute('aria-disabled', 'true');
    expect(offlineRow).toHaveClass('border-dashed');
    expect(within(offlineRow).getByText('офлайн')).toBeInTheDocument();
    expect(within(offlineRow).getByText('вернётся с интернетом')).toBeInTheDocument();

    fireEvent.click(offlineRow);
    expect(props.onStartMode).not.toHaveBeenCalled();
    expect(getToast()?.text).toBe(
      'Нет интернета. Всё письменное работает; голос вернётся с сетью.',
    );
    dismissToast();

    const voiceRow = screen.getByRole('button', { name: /Скажите вслух/ });
    expect(within(voiceRow).getByText('голос')).toBeInTheDocument();
    expect(within(voiceRow).getByText('нужен испанский голос')).toBeInTheDocument();

    fireEvent.click(voiceRow);
    expect(props.onStartMode).not.toHaveBeenCalled();
    expect(getToast()?.text).toContain('Добавить испанский голос');
    dismissToast();
  });
});

describe('HomeScreen header', () => {
  it('opens stats and settings through the icon buttons', () => {
    const props = renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Статистика' }));
    fireEvent.click(screen.getByRole('button', { name: 'Настройки' }));
    expect(props.onOpenStats).toHaveBeenCalledTimes(1);
    expect(props.onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('swaps in the offline chip when the network drops, and back when it returns', () => {
    renderHome();
    const header = screen.getByRole('banner');
    expect(within(header).queryByText('офлайн')).not.toBeInTheDocument();

    fireEvent(window, new Event('offline'));
    expect(within(header).getByText('офлайн')).toBeInTheDocument();

    fireEvent(window, new Event('online'));
    expect(within(header).queryByText('офлайн')).not.toBeInTheDocument();
  });
});
