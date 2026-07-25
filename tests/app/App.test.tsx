import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import { summaryDayState } from '@/app/day-state';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { init as initI18n } from '@/i18n';
import type { AnswerRecord, Question, RoundSerialized, RoundSummary } from '@/session';
import { getRound, getSettings, setDay, setRound, updateProgress, updateSettings } from '@/storage';

/**
 * Capability probes the home rows depend on. They are stubbed rather than
 * simulated because happy-dom has neither speech synthesis nor recognition, and
 * "every mode is paused" would make every other assertion here unreadable.
 */
const caps = vi.hoisted(() => ({
  voice: 'es-ES' as 'es-ES' | 'es-other' | 'none',
  mic: true,
  voiceListeners: new Set<(status: 'es-ES' | 'es-other' | 'none') => void>(),
}));

vi.mock('@/services/tts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/tts')>();
  return {
    ...actual,
    getVoiceStatus: () => caps.voice,
    onVoicesChanged: (cb: (status: 'es-ES' | 'es-other' | 'none') => void) => {
      caps.voiceListeners.add(cb);
      return () => {
        caps.voiceListeners.delete(cb);
      };
    },
  };
});

vi.mock('@/services/speech', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/speech')>();
  return { ...actual, isRecognitionSupported: () => caps.mic };
});

/** Fire the voice-availability change the tts service would have fired. */
function emitVoice(status: 'es-ES' | 'es-other' | 'none'): void {
  caps.voice = status;
  act(() => {
    for (const listener of caps.voiceListeners) listener(status);
  });
}

function setSearch(search: string): void {
  window.history.replaceState({}, '', `/${search}`);
}

/** The id the words mode mints for a value; a round is resumed by its own mode. */
function wordsId(value: number): string {
  return `words:n${value}`;
}

function question(value: number): Question {
  return {
    id: wordsId(value),
    bucket: 'd0_15',
    prompt: { kind: 'number', value },
    accepted: { canonical: `numero ${value}`, variants: [{ text: `numero ${value}` }] },
  };
}

function answered(value: number): AnswerRecord {
  return {
    questionId: wordsId(value),
    bucket: 'd0_15',
    given: 'x',
    verdict: 'correct',
    fromWrongQueue: false,
  };
}

/** A words round parked two answers in, with its third question on stage. */
function parkedRound(): RoundSerialized {
  return {
    version: 1,
    config: {
      modeId: 'words',
      size: 10,
      rangeMin: 0,
      rangeMax: 100,
      seed: 7,
      acceptNoAccents: true,
    },
    rngDraws: 0,
    step: 3,
    served: [question(4), question(9), question(12)],
    records: [answered(4), answered(9)],
    score: { points: 20, combo: 2, bestCombo: 2 },
    lastWrongQueueStep: -3,
    finished: false,
    retry: false,
    retryItems: [],
  };
}

function press(name: string | RegExp): void {
  fireEvent.click(screen.getByRole('button', { name }));
}

/** Home rows are the buttons inside the mode list, in registry order. */
function modeRows(): HTMLElement[] {
  return within(screen.getByRole('list')).getAllByRole('button');
}

function rowNamed(title: string | RegExp): HTMLElement {
  const row = modeRows().find((candidate) => within(candidate).queryByText(title) !== null);
  if (row === undefined) throw new Error(`no mode row matching ${String(title)}`);
  return row;
}

beforeEach(() => {
  localStorage.clear();
  initI18n({ initialLang: 'en' });
  setSearch('');
  caps.voice = 'es-ES';
  caps.mic = true;
  caps.voiceListeners.clear();
  // The shortest round keeps the drill counter ("1 of 10") a cheap landmark.
  updateSettings({ onboarded: true, roundSize: 10 });
});

afterEach(() => {
  setSearch('');
});

describe('App home', () => {
  it('opens on home with a row for every registered mode', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/good/i);
    expect(modeRows()).toHaveLength(6);
    expect(screen.getByText('Number → in words')).toBeInTheDocument();
    expect(screen.getByText('475 → cuatrocientos setenta y cinco')).toBeInTheDocument();
  });

  // The gallery is a lazy chunk, so its first paint is a tick away.
  it('renders the component gallery for ?gallery', async () => {
    setSearch('?gallery=1');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('gallery');
  });

  it('pauses the modes whose capabilities the browser cannot serve', () => {
    caps.voice = 'none';
    caps.mic = false;
    render(<App />);

    expect(within(rowNamed('By ear')).getByText('needs a Spanish voice')).toBeInTheDocument();
    expect(
      within(rowNamed('Say it aloud')).getByText('needs microphone access'),
    ).toBeInTheDocument();
    // Written modes need neither, so they stay startable — including the shop
    // counter, where audio is only a replay of a price already on screen.
    expect(rowNamed('Number → in words')).not.toHaveAttribute('aria-disabled');
    expect(rowNamed('Prices & weights')).not.toHaveAttribute('aria-disabled');
  });

  it('pauses every voice mode while offline, and restores them when the network returns', () => {
    render(<App />);
    expect(rowNamed('By ear')).not.toHaveAttribute('aria-disabled');

    act(() => {
      fireEvent(window, new Event('offline'));
    });
    expect(within(rowNamed('By ear')).getByText('back with the internet')).toBeInTheDocument();
    expect(
      within(rowNamed('Say it aloud')).getByText('back with the internet'),
    ).toBeInTheDocument();
    expect(rowNamed('Number → in words')).not.toHaveAttribute('aria-disabled');

    act(() => {
      fireEvent(window, new Event('online'));
    });
    expect(rowNamed('By ear')).not.toHaveAttribute('aria-disabled');
  });

  it('unpauses a listening mode the moment a Spanish voice appears', () => {
    caps.voice = 'none';
    render(<App />);
    expect(rowNamed('By ear')).toHaveAttribute('aria-disabled', 'true');

    emitVoice('es-ES');

    expect(rowNamed('By ear')).not.toHaveAttribute('aria-disabled');
  });

  it('remembers the mode it starts and lands in the drill', () => {
    render(<App />);
    fireEvent.click(rowNamed('Prices & weights'));

    expect(getSettings().lastMode).toBe('grocery');
    expect(screen.getByText('1 of 10')).toBeInTheDocument();
  });

  it('plays a mixed round from the big button, without claiming it as a mode choice', () => {
    updateSettings({ lastMode: 'digits' });
    render(<App />);

    press(/Start/);
    expect(screen.getByText('1 of 10')).toBeInTheDocument();
    // The button is a round, not a mode: the row choice below it still stands.
    expect(getSettings().lastMode).toBe('digits');

    // Leaving parks the round under the mode that is actually running.
    press('Close');
    expect(getRound()?.modeId).toBe('mixed');
  });

  it('resumes a parked single-mode round from its own row, not from the big button', () => {
    updateSettings({ lastMode: 'digits' });
    setRound('words', parkedRound());
    render(<App />);

    // The big button is the mixed round, always: a parked words round never
    // takes it over. The row it belongs to is what says "continue".
    expect(screen.queryByRole('button', { name: /Continue/ })).not.toBeInTheDocument();
    const row = rowNamed('Number → in words');
    expect(within(row).getByText('continue · 2 of 10')).toBeInTheDocument();

    fireEvent.click(row);

    expect(getSettings().lastMode).toBe('words');
    expect(screen.getByText('3 of 10')).toBeInTheDocument();
  });

  it('resumes past a parked question the mode cannot present, instead of onto it', () => {
    const parked = parkedRound();
    const foreign: Question = {
      id: 'grocery:q1500',
      bucket: 'qty_fractions',
      prompt: { kind: 'quantity', grams: 1500 },
      accepted: { canonical: 'kilo y medio', variants: [{ text: 'kilo y medio' }] },
    };
    setRound('words', { ...parked, served: [...parked.served.slice(0, 2), foreign] });
    render(<App />);

    fireEvent.click(rowNamed('Number → in words'));

    // On the step the round was left at, holding a question this mode can draw
    // instead of the one it cannot — the progress never rewinds.
    expect(screen.getByText('3 of 10')).toBeInTheDocument();
    expect(screen.queryByText('1500')).not.toBeInTheDocument();
  });

  it('starts a fresh mixed round from the big button while a single-mode round is parked', () => {
    updateSettings({ lastMode: 'digits' });
    setRound('words', parkedRound());
    render(<App />);

    press(/Start/);

    // A round of its own, from question one — not the parked words round.
    expect(screen.getByText('1 of 10')).toBeInTheDocument();
    expect(getSettings().lastMode).toBe('digits');
  });
});

describe('App navigation', () => {
  it('opens stats from the header and comes back', () => {
    render(<App />);
    press('Stats');

    expect(screen.getByRole('heading', { name: 'Stats' })).toBeInTheDocument();

    press('Back');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/good/i);
  });

  it('starts a round from the empty stats screen', () => {
    render(<App />);
    press('Stats');
    press('Start the first round');

    expect(screen.getByText('1 of 10')).toBeInTheDocument();
  });

  it('opens settings, then the report screen, and closes back to settings', () => {
    render(<App />);
    press('Settings');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();

    press('Report a problem');
    expect(screen.getByRole('heading', { name: 'Report a problem' })).toBeInTheDocument();

    press('Close');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });
});

describe('App onboarding gate', () => {
  beforeEach(() => {
    updateSettings({ onboarded: false });
  });

  /**
   * Onboarding leads with the install offer (happy-dom fires no
   * `beforeinstallprompt`, so it opens in its 'manual' state). It is never a
   * gate, and the affordance matrix is covered in tests/screens/onboarding —
   * here it is one ghost tap on the way to the steps under test.
   */
  function skipInstallStep(): void {
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Install it on your phone');
    press('Continue in the browser');
  }

  it('holds a first-time learner in onboarding', () => {
    render(<App />);
    skipInstallStep();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello!');
  });

  it('lands on home when the learner wants to look around first', () => {
    render(<App />);
    skipInstallStep();
    press('English');
    press('Next');
    press('Next');
    press('Look at the modes first');

    expect(getSettings().onboarded).toBe(true);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/good/i);
  });

  it('starts the first round straight from the last step', () => {
    render(<App />);
    skipInstallStep();
    press('English');
    press('Next');
    press('Next');
    press('Start the first round');

    // The first round is the mixed one, and it is no mode choice either.
    expect(getSettings().lastMode).toBeNull();
    expect(screen.getByText('1 of 10')).toBeInTheDocument();
  });
});

function Boom(): never {
  throw new Error('render exploded');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    initI18n({ initialLang: 'en' });
  });

  it('renders the crash screen instead of a blank page', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('opens the report screen from the crash screen and closes back to it', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    press('Report a problem');
    expect(screen.getByRole('heading', { name: 'Report a problem' })).toBeInTheDocument();

    press('Close');
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('leaves a healthy tree alone', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Something went wrong' })).not.toBeInTheDocument();
  });
});

const TODAY = '2026-07-24';

function summary(overrides: Partial<RoundSummary> = {}): RoundSummary {
  return {
    modeId: 'words',
    size: 10,
    total: 10,
    correctCount: 8,
    almostCount: 1,
    wrongCount: 2,
    accuracy: 0.8,
    points: 80,
    bestCombo: 4,
    verdicts: [],
    missed: [],
    ...overrides,
  };
}

describe('summaryDayState', () => {
  const now = new Date(2026, 6, 24, 9, 0, 0);

  beforeEach(() => {
    updateSettings({ dailyGoal: 10 });
  });

  it('reports the goal unmet with the day’s running total', () => {
    setDay({ date: TODAY, answered: 9, correct: 8, byGroup: {} });
    expect(summaryDayState(summary(), now)).toEqual({
      goalMet: false,
      stampedToday: false,
      streakDays: 0,
      done: 8,
      total: 10,
    });
  });

  it('stamps the day the round that reaches the goal, without claiming it was already stamped', () => {
    setDay({ date: TODAY, answered: 12, correct: 11, byGroup: {} });
    updateProgress({
      streakCurrent: 3,
      streakBest: 5,
      lastGoalDate: TODAY,
      bestCombo: 6,
      totalAnswered: 40,
      totalCorrect: 30,
    });

    expect(summaryDayState(summary(), now)).toMatchObject({
      goalMet: true,
      stampedToday: false,
      streakDays: 3,
      // Capped at the goal: the ring never overfills.
      done: 10,
      total: 10,
    });
  });

  it('knows the stamp was already earned before this round', () => {
    setDay({ date: TODAY, answered: 30, correct: 25, byGroup: {} });
    expect(summaryDayState(summary(), now)).toMatchObject({ goalMet: true, stampedToday: true });
  });

  it('treats a zero goal as one answer rather than stamping an empty day', () => {
    updateSettings({ dailyGoal: 0 });
    expect(summaryDayState(summary({ correctCount: 0 }), now)).toMatchObject({
      goalMet: false,
      total: 1,
      done: 0,
    });
  });
});
