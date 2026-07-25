import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatNumber } from '@/engine';
import { init } from '@/i18n';
import type { StatsScreenProps } from '@/screens/StatsScreen';
import { StatsScreen } from '@/screens/StatsScreen';
import type { SrsState } from '@/session';
import { initSrs, serializeSrs } from '@/session';
import { getSettings, setDay, setSettings, setSrs, updateProgress } from '@/storage';
import { plainSpaces } from '../helpers/text';

const NOW = new Date(2026, 6, 24, 12, 0, 0);
const TODAY = '2026-07-24';
const YESTERDAY = '2026-07-23';

function seededSrs(): SrsState {
  const srs = initSrs();
  srs.answeredCount = 120;
  // Percentages are kept distinct from each other and from the month accuracy
  // so a text query can never match the wrong number.
  srs.buckets.d0_15 = { attempts: 50, correct: 48, last20: [] }; // 96%
  srs.buckets.tens_y = { attempts: 40, correct: 34, last20: [] }; // 85%
  srs.buckets.hundreds_reg = { attempts: 30, correct: 22, last20: [] }; // 73%
  srs.buckets.thousands = { attempts: 25, correct: 10, last20: [] }; // 40% — warns
  srs.buckets.price_cents = { attempts: 20, correct: 15, last20: [] }; // 75%
  srs.buckets.qty_grams = { attempts: 12, correct: 8, last20: [] }; // 67%
  return srs;
}

interface SeedOptions {
  streakCurrent?: number;
  streakBest?: number;
  totalAnswered?: number;
  todayCorrect?: number;
}

function seedHistory(options: SeedOptions = {}): void {
  setSettings({ ...getSettings(), dailyGoal: 20 });
  setSrs(serializeSrs(seededSrs()));
  updateProgress({
    streakCurrent: options.streakCurrent ?? 3,
    streakBest: options.streakBest ?? 11,
    lastGoalDate: YESTERDAY,
    bestCombo: 9,
    totalAnswered: options.totalAnswered ?? 1284,
    totalCorrect: 1100,
  });
  setDay({ date: YESTERDAY, answered: 24, correct: 22, byGroup: {} });
  setDay({ date: TODAY, answered: 50, correct: options.todayCorrect ?? 43, byGroup: {} });
}

function renderStats(overrides: Partial<StatsScreenProps> = {}): StatsScreenProps {
  const props: StatsScreenProps = {
    onBack: vi.fn(),
    onStartFirstRound: vi.fn(),
    ...overrides,
  };
  render(<StatsScreen {...props} />);
  return props;
}

beforeAll(() => {
  init({ initialLang: 'ru' });
});

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('StatsScreen day zero', () => {
  it('shows the empty state instead of tiles and skills', () => {
    renderStats();

    expect(screen.getByRole('heading', { level: 2, name: 'Пока пусто' })).toBeInTheDocument();
    expect(
      screen.getByText('Один раунд — и здесь появятся точность, серия и навыки.'),
    ).toBeInTheDocument();
    expect(screen.getByText('первый штамп — за первый раунд сегодня')).toBeInTheDocument();
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
    expect(screen.queryByText('ответов всего')).not.toBeInTheDocument();
  });

  it('sends the learner into a first round from the empty state', () => {
    const props = renderStats();
    fireEvent.click(screen.getByRole('button', { name: 'Начать первый раунд' }));
    expect(props.onStartFirstRound).toHaveBeenCalledTimes(1);
  });

  it('draws the seven-day window with today still waiting', () => {
    const { container } = render(<StatsScreen onBack={vi.fn()} onStartFirstRound={vi.fn()} />);
    const stamps = [...container.querySelectorAll('[data-state]')];
    expect(stamps).toHaveLength(7);
    expect(stamps.map((node) => node.getAttribute('data-state'))).toEqual([
      'future',
      'future',
      'future',
      'today',
      'future',
      'future',
      'future',
    ]);
  });
});

describe('StatsScreen with history', () => {
  it('fills the tiles from storage and the month day rows', () => {
    seedHistory();
    renderStats();

    expect(screen.getByText(plainSpaces(formatNumber(1284)))).toBeInTheDocument();
    expect(screen.getByText('ответов всего')).toBeInTheDocument();
    // 22 + 43 correct of 24 + 50 answered this month.
    expect(screen.getByText('88%')).toBeInTheDocument();
    expect(screen.getByText('точность за месяц')).toBeInTheDocument();
  });

  it('renders one skill bar per display group, in order', () => {
    seedHistory();
    renderStats();

    const bars = screen.getAllByRole('progressbar');
    expect(bars).toHaveLength(6);
    expect(bars.map((bar) => bar.getAttribute('aria-label'))).toEqual([
      'единицы · 1–9',
      'десятки · 10–99',
      'сотни · 100–999',
      'тысячи',
      'цены · €',
      'веса · кг, г',
    ]);
    expect(
      screen.getByText('трудные числа появляются чаще сами — ничего настраивать не нужно'),
    ).toBeInTheDocument();
  });

  it('warns and flags a group under 60%, and leaves healthy ones alone', () => {
    seedHistory();
    renderStats();

    const weak = screen.getByRole('progressbar', { name: 'тысячи' });
    expect(weak).toHaveAttribute('aria-valuenow', '40');
    expect(weak.firstElementChild).toHaveClass('bg-almost');
    expect(screen.getByText('потренировать')).toBeInTheDocument();

    const strong = screen.getByRole('progressbar', { name: 'единицы · 1–9' });
    expect(strong).toHaveAttribute('aria-valuenow', '96');
    expect(strong.firstElementChild).toHaveClass('bg-correct');
  });

  it('declines the record and the waiting-stamp line', () => {
    seedHistory({ streakCurrent: 3, streakBest: 11, todayCorrect: 12 });
    renderStats();

    expect(screen.getByText('рекорд — 11 дней')).toBeInTheDocument();
    expect(screen.getByText('3 дня подряд — сегодняшний штамп ждёт')).toBeInTheDocument();
  });

  it('declines a one-day record', () => {
    seedHistory({ streakCurrent: 1, streakBest: 1, todayCorrect: 5 });
    renderStats();
    expect(screen.getByText('рекорд — 1 день')).toBeInTheDocument();
    expect(screen.getByText('1 день подряд — сегодняшний штамп ждёт')).toBeInTheDocument();
  });

  it('swaps the waiting line for the streak once today is stamped', () => {
    seedHistory({ streakCurrent: 5, streakBest: 11, todayCorrect: 43 });
    const { container } = render(<StatsScreen onBack={vi.fn()} onStartFirstRound={vi.fn()} />);

    expect(screen.queryByText(/штамп ждёт/)).not.toBeInTheDocument();
    expect(screen.getByText('5 дней')).toBeInTheDocument();

    const stamps = [...container.querySelectorAll('[data-state]')];
    expect(stamps.map((node) => node.getAttribute('data-state'))).toEqual([
      'future',
      'future',
      'done',
      'done',
      'future',
      'future',
      'future',
    ]);
  });

  it('goes back through the header button', () => {
    seedHistory();
    const props = renderStats();
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });
});
