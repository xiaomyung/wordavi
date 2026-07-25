import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatPrice } from '@/engine';
import { init } from '@/i18n';
import type { SummaryDayState, SummaryScreenProps } from '@/screens/SummaryScreen';
import { SummaryScreen } from '@/screens/SummaryScreen';
import type { AnswerRecord, PromptPayload, Question, RoundSummary, Verdict } from '@/session';
import { getSettings, setSettings } from '@/storage';
import { plainSpaces } from '../helpers/text';

/** GoalRing's reduced-motion fallback timer; the sweep "lands" here in tests. */
const RING_MS = 650;
/** motion.md: the day stamp pops 420ms after the ring lands. */
const STAMP_DELAY_MS = 420;

function question(id: string, prompt: PromptPayload, canonical: string): Question {
  return {
    id,
    bucket: 'hundreds_reg',
    prompt,
    accepted: { canonical, variants: [{ text: canonical }] },
  };
}

function record(id: string, given: string, verdict: Verdict): AnswerRecord {
  return { questionId: id, bucket: 'hundreds_reg', given, verdict, fromWrongQueue: false };
}

const MISSED: readonly Question[] = [
  question('q3', { kind: 'number', value: 914 }, 'novecientos catorce'),
  question('q5', { kind: 'price', euros: 2, cents: 35 }, 'dos con treinta y cinco'),
  question('q7', { kind: 'quantity', grams: 1500 }, 'kilo y medio'),
];

function buildSummary(overrides: Partial<RoundSummary> = {}): RoundSummary {
  return {
    modeId: 'words',
    size: 8,
    total: 8,
    correctCount: 5,
    almostCount: 1,
    wrongCount: 3,
    accuracy: 5 / 8,
    points: 270,
    bestCombo: 7,
    verdicts: [
      record('q1', 'cuatrocientos setenta y cinco', 'correct'),
      record('q2', 'veintiséis', 'almost'),
      record('q3', '904', 'wrong'),
      record('q4', 'dos con veinte', 'correct'),
      record('q5', 'dos con veinticinco', 'wrong'),
      record('q6', 'ciento ocho', 'correct'),
      record('q7', 'medio kilo', 'wrong'),
      record('q8', 'quinientos', 'correct'),
    ],
    missed: [...MISSED],
    ...overrides,
  };
}

const DAY_MET: SummaryDayState = {
  goalMet: true,
  stampedToday: false,
  streakDays: 4,
  done: 20,
  total: 20,
};

const DAY_OPEN: SummaryDayState = {
  goalMet: false,
  stampedToday: false,
  streakDays: 3,
  done: 12,
  total: 20,
};

function renderSummary(overrides: Partial<SummaryScreenProps> = {}): SummaryScreenProps {
  const props: SummaryScreenProps = {
    summary: buildSummary(),
    dayState: DAY_OPEN,
    onRetryMissed: vi.fn(),
    onBackHome: vi.fn(),
    ...overrides,
  };
  render(<SummaryScreen {...props} />);
  return props;
}

beforeAll(() => {
  init({ initialLang: 'ru' });
});

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 24, 20, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SummaryScreen header', () => {
  it('titles the round with the mode and a declined question count', () => {
    renderSummary();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Раунд завершён');
    expect(screen.getByText('Число → словами · 8 вопросов')).toBeInTheDocument();
  });

  it('declines a one-question retry round', () => {
    renderSummary({
      summary: buildSummary({
        total: 1,
        size: 1,
        correctCount: 1,
        almostCount: 0,
        wrongCount: 0,
        accuracy: 1,
        verdicts: [record('q1', 'cinco', 'correct')],
        missed: [],
      }),
    });
    expect(screen.getByText('Число → словами · 1 вопрос')).toBeInTheDocument();
  });

  it('shows accuracy, score line and a warm congratulation above the threshold', () => {
    renderSummary();
    expect(screen.getByText('63%')).toBeInTheDocument();
    expect(screen.getByText('5 из 8')).toBeInTheDocument();
    expect(screen.getByText('+270 очков · лучшая серия ×7')).toBeInTheDocument();
    expect(screen.getByText('¡Muy bien!')).toBeInTheDocument();
  });

  it('stays quiet about congratulations on a rough round', () => {
    renderSummary({
      summary: buildSummary({ correctCount: 3, wrongCount: 5, accuracy: 3 / 8 }),
    });
    expect(screen.queryByText('¡Muy bien!')).not.toBeInTheDocument();
  });
});

describe('SummaryScreen question list', () => {
  it('lists every miss up front with the answer given and the correction', () => {
    renderSummary();

    expect(screen.getByText('914')).toBeInTheDocument();
    expect(screen.getByText('904')).toBeInTheDocument();
    expect(screen.getByText('novecientos catorce')).toBeInTheDocument();

    expect(screen.getByText(plainSpaces(formatPrice(2, 35)))).toBeInTheDocument();
    expect(screen.getByText('dos con treinta y cinco')).toBeInTheDocument();

    expect(screen.getByText('1,5 кг')).toBeInTheDocument();
    expect(screen.getByText('kilo y medio')).toBeInTheDocument();
  });

  it('strikes through what the learner actually answered', () => {
    const { container } = render(
      <SummaryScreen
        summary={buildSummary()}
        dayState={DAY_OPEN}
        onRetryMissed={vi.fn()}
        onBackHome={vi.fn()}
      />,
    );
    const struck = [...container.querySelectorAll('s')].map((node) => node.textContent);
    expect(struck).toEqual(['904', 'dos con veinticinco', 'medio kilo']);
  });

  it('collapses the correct answers behind a counted expander', () => {
    renderSummary();
    expect(screen.queryByText('cuatrocientos setenta y cinco')).not.toBeInTheDocument();

    const expander = screen.getByRole('button', { name: '…и ещё 5' });
    fireEvent.click(expander);

    expect(screen.getByText('cuatrocientos setenta y cinco')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /и ещё/ })).not.toBeInTheDocument();
  });

  it('keeps misses above the expanded correct answers', () => {
    renderSummary();
    fireEvent.click(screen.getByRole('button', { name: '…и ещё 5' }));

    const miss = screen.getByText('904');
    const correct = screen.getByText('cuatrocientos setenta y cinco');
    // compareDocumentPosition returns a bitmask; FOLLOWING means "later in the document".
    const relation = miss.compareDocumentPosition(correct);
    expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('SummaryScreen day stamp sequencing', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), configurable: true });
  });

  it('pops the day stamp only after the ring has swept', () => {
    renderSummary({ dayState: DAY_MET });

    expect(screen.queryByText(/День 4 отмечен/)).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(RING_MS);
    });
    expect(screen.queryByText(/День 4 отмечен/)).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(STAMP_DELAY_MS);
    });
    expect(
      screen.getByText('День 4 отмечен · дневная цель достигнута, 20 из 20'),
    ).toBeInTheDocument();
    expect(document.querySelector('.wa-stamp-pop')).not.toBeNull();
    expect(navigator.vibrate).toHaveBeenCalledTimes(1);
  });

  it('never stamps a day whose goal is still open', () => {
    renderSummary({ dayState: DAY_OPEN });
    act(() => {
      vi.advanceTimersByTime(RING_MS + STAMP_DELAY_MS);
    });
    expect(screen.queryByText(/отмечен/)).not.toBeInTheDocument();
    expect(navigator.vibrate).not.toHaveBeenCalled();
  });

  it('shows an already-earned stamp without celebrating it twice', () => {
    renderSummary({ dayState: { ...DAY_MET, stampedToday: true } });
    act(() => {
      vi.advanceTimersByTime(RING_MS + STAMP_DELAY_MS);
    });
    expect(screen.getByText(/День 4 отмечен/)).toBeInTheDocument();
    expect(document.querySelector('.wa-stamp-pop')).toBeNull();
    expect(navigator.vibrate).not.toHaveBeenCalled();
  });

  it('respects the answer-sounds setting when stamping', () => {
    setSettings({ ...getSettings(), soundsEnabled: true });
    renderSummary({ dayState: DAY_MET });
    act(() => {
      vi.advanceTimersByTime(RING_MS + STAMP_DELAY_MS);
    });
    expect(screen.getByText(/День 4 отмечен/)).toBeInTheDocument();
  });
});

describe('SummaryScreen actions', () => {
  it('offers the retry CTA with the miss count', () => {
    const props = renderSummary();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить ошибки (3)' }));
    expect(props.onRetryMissed).toHaveBeenCalledTimes(1);
  });

  it('hides the retry CTA on a clean round', () => {
    renderSummary({
      summary: buildSummary({
        correctCount: 8,
        wrongCount: 0,
        accuracy: 1,
        verdicts: [record('q1', 'cinco', 'correct')],
        missed: [],
        total: 1,
        size: 1,
      }),
    });
    expect(screen.queryByRole('button', { name: /Повторить/ })).not.toBeInTheDocument();
  });

  it('always offers the way home', () => {
    const props = renderSummary();
    fireEvent.click(screen.getByRole('button', { name: 'На главный' }));
    expect(props.onBackHome).toHaveBeenCalledTimes(1);
  });
});
