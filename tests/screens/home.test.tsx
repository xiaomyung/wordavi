import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n, { init } from '@/i18n';
import type { HomeModeItem, HomeScreenProps, ParkedRound } from '@/screens/HomeScreen';
import { HomeScreen, parkedRoundFrom } from '@/screens/HomeScreen';
import {
  canPromptInstall,
  isInstalled,
  isIos,
  isStandalone,
  promptInstall,
} from '@/services/install';
import type { AnswerRecord, RoundSerialized, RoundSize } from '@/session';
import type { SavedRound } from '@/storage';
import { getSettings, setDay, setSettings, updateProgress } from '@/storage';

// The install invitation reads the affordance from this service; the defaults
// leave it 'hidden', which is what every other home test expects to see.
/** Stands in for the service's own availability bus (prompt captured / installed). */
const installBus = vi.hoisted(() => ({ listeners: new Set<() => void>() }));

vi.mock('@/services/install', async () => {
  const { installMock } = await import('../helpers/mocks');
  return installMock(installBus);
});

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
    onStartMixed: vi.fn(),
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

/** A parked round as the app hands it to the screen. */
function parked(modeId: string, done: number, total: RoundSize): ParkedRound {
  return { modeId, done, total };
}

/** History is what turns "start the first round" into "start a round". */
function seedHistory(): void {
  updateProgress({
    streakCurrent: 1,
    streakBest: 1,
    lastGoalDate: TODAY,
    bestCombo: 3,
    totalAnswered: 60,
    totalCorrect: 50,
  });
}

function seedDay(correct: number, answered = correct): void {
  setDay({ date: TODAY, answered, correct, byGroup: {} });
}

beforeAll(() => {
  init({ initialLang: 'ru' });
});

beforeEach(() => {
  localStorage.clear();
  // Call counts must not leak between tests — the install mocks live for the
  // whole file, unlike the per-render prop spies.
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(MORNING);
  vi.mocked(isStandalone).mockReturnValue(false);
  vi.mocked(canPromptInstall).mockReturnValue(false);
  vi.mocked(isIos).mockReturnValue(false);
  vi.mocked(isInstalled).mockResolvedValue(false);
  vi.mocked(promptInstall).mockResolvedValue('accepted');
  installBus.listeners.clear();
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
  it('offers to resume with "N of M" when the parked round is the mixed one', () => {
    const props = renderHome({ parkedRound: parked('mixed', 12, 30) });

    const cta = screen.getByRole('button', { name: 'Продолжить · 12 из 30' });
    fireEvent.click(cta);
    expect(props.onResume).toHaveBeenCalledTimes(1);
    expect(props.onStartMode).not.toHaveBeenCalled();
    expect(props.onStartMixed).not.toHaveBeenCalled();
  });

  it('shows the endless marker instead of a question count', () => {
    renderHome({ parkedRound: parked('mixed', 7, 'endless') });
    expect(screen.getByRole('button', { name: 'Продолжить · 7 из ∞' })).toBeInTheDocument();
  });

  it('starts a mixed first round for a learner with no history', () => {
    const props = renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Начать первый раунд' }));
    expect(props.onStartMixed).toHaveBeenCalledTimes(1);
    expect(props.onStartMode).not.toHaveBeenCalled();
  });

  it('starts a mixed round once there is history, whatever was played last', () => {
    setSettings({ ...getSettings(), lastMode: 'grocery' });
    seedHistory();
    const props = renderHome();

    fireEvent.click(screen.getByRole('button', { name: 'Начать раунд' }));
    expect(props.onStartMixed).toHaveBeenCalledTimes(1);
    expect(props.onStartMode).not.toHaveBeenCalled();
  });

  it('never lets a parked single-mode round take over the big button', () => {
    seedHistory();
    const props = renderHome({ parkedRound: parked('words', 4, 10) });

    expect(screen.queryByRole('button', { name: /Продолжить/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Начать раунд' }));
    expect(props.onStartMixed).toHaveBeenCalledTimes(1);
    expect(props.onResume).not.toHaveBeenCalled();
    expect(props.onStartMode).not.toHaveBeenCalled();
  });
});

describe('HomeScreen parked round hint', () => {
  it('marks the row of a parked single-mode round, and resumes it from there', () => {
    const props = renderHome({ parkedRound: parked('words', 4, 10) });

    const row = screen.getByRole('button', { name: /Число → словами/ });
    expect(within(row).getByText('продолжить · 4 из 10')).toBeInTheDocument();

    fireEvent.click(row);
    expect(props.onStartMode).toHaveBeenCalledWith('words');
  });

  it('marks no row for a parked mixed round — it has none', () => {
    renderHome({ parkedRound: parked('mixed', 4, 10) });
    expect(within(screen.getByRole('list')).queryByText(/продолжить ·/)).not.toBeInTheDocument();
  });

  it('leaves a paused row explaining itself rather than the parked round', () => {
    renderHome({ parkedRound: parked('listen', 2, 10) });

    const row = screen.getByRole('button', { name: /На слух/ });
    expect(within(row).getByText('офлайн')).toBeInTheDocument();
    expect(within(row).queryByText(/продолжить ·/)).not.toBeInTheDocument();
  });
});

describe('parkedRoundFrom', () => {
  it('returns null without a slot, for junk, and for a finished round', () => {
    expect(parkedRoundFrom(null)).toBeNull();
    const junk: SavedRound = { modeId: 'words', updatedAt: 'now', state: { nope: true } };
    expect(parkedRoundFrom(junk)).toBeNull();
    const finished: SavedRound = {
      modeId: 'words',
      updatedAt: 'now',
      state: serializedRound(30, 30, { finished: true }),
    };
    expect(parkedRoundFrom(finished)).toBeNull();
  });

  it('carries the slot’s own mode, not the round config’s', () => {
    const saved: SavedRound = {
      modeId: 'mixed',
      updatedAt: 'now',
      state: serializedRound(3, 10),
    };
    expect(parkedRoundFrom(saved)).toEqual({ modeId: 'mixed', done: 3, total: 10 });
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
    expect(parkedRoundFrom(saved)).toEqual({ modeId: 'words', done: 1, total: 2 });
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

describe('HomeScreen install invitation', () => {
  const INVITE = /Можно установить как приложение/;

  function invite(): HTMLElement | null {
    return screen.queryByText(INVITE);
  }

  it('invites with the browser-menu recipe when no prompt event exists', () => {
    // Brave/Firefox never fire beforeinstallprompt — the offer is still real.
    renderHome();
    expect(invite()).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Установить' }));
    expect(screen.getByText('Установить через меню браузера')).toBeInTheDocument();
    expect(screen.getByText(/Откройте меню браузера/)).toBeInTheDocument();
    expect(promptInstall).not.toHaveBeenCalled();

    // Tapping again folds the recipe away.
    fireEvent.click(screen.getByRole('button', { name: 'Установить' }));
    expect(screen.queryByText('Установить через меню браузера')).toBeNull();
  });

  it('stays away when the device says the app is already installed', async () => {
    vi.mocked(isInstalled).mockResolvedValue(true);
    renderHome();
    await act(async () => undefined);
    expect(invite()).toBeNull();
  });

  it('upgrades to the real prompt when the browser captures one', async () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Установить' }));
    expect(screen.getByText('Установить через меню браузера')).toBeInTheDocument();

    vi.mocked(canPromptInstall).mockReturnValue(true);
    await act(async () => {
      for (const listener of installBus.listeners) listener();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Установить' }));
    expect(promptInstall).toHaveBeenCalled();
  });

  it('stays away when the app already runs standalone', () => {
    vi.mocked(isStandalone).mockReturnValue(true);
    vi.mocked(canPromptInstall).mockReturnValue(true);
    renderHome();
    expect(invite()).toBeNull();
  });

  it('invites quietly between the round button and the mode list', () => {
    vi.mocked(canPromptInstall).mockReturnValue(true);
    renderHome();

    const caption = screen.getByText(INVITE);
    const cta = screen.getByRole('button', { name: 'Начать первый раунд' });
    const modes = screen.getByText('режимы');
    expect(cta.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(caption.compareDocumentPosition(modes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('fires the captured prompt and steps aside once accepted', async () => {
    vi.mocked(canPromptInstall).mockReturnValue(true);
    // A real accepted prompt consumes the captured event, so the offer stops
    // being true the moment it resolves.
    vi.mocked(promptInstall).mockImplementation(async () => {
      vi.mocked(canPromptInstall).mockReturnValue(false);
      return 'accepted';
    });
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: 'Установить' }));
    expect(promptInstall).toHaveBeenCalled();

    await act(async () => undefined);
    expect(invite()).toBeNull();
  });

  it('shows the iOS recipe instead of the generic one', () => {
    vi.mocked(isIos).mockReturnValue(true);
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: 'Установить' }));
    expect(screen.getByText('Установить на iPhone')).toBeInTheDocument();
    expect(screen.queryByText('Установить через меню браузера')).toBeNull();
    expect(promptInstall).not.toHaveBeenCalled();
  });

  it('disappears when the browser reports the app installed', async () => {
    vi.mocked(canPromptInstall).mockReturnValue(true);
    renderHome();
    expect(invite()).not.toBeNull();

    // What install.ts does on `appinstalled`: drop the event, tell subscribers.
    vi.mocked(canPromptInstall).mockReturnValue(false);
    vi.mocked(isStandalone).mockReturnValue(true);
    await act(async () => {
      for (const listener of installBus.listeners) listener();
    });
    expect(invite()).toBeNull();
  });
});
