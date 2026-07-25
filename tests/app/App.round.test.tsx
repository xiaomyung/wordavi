import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import { init as initI18n } from '@/i18n';
import type { AnswerZoneProps, PromptProps } from '@/modes';
import { SWAP_OUT_MS } from '@/screens/drill/useDrillRound';
import type { PromptPayload, QuestionSource } from '@/session';
import { getProgress, getRound, updateSettings } from '@/storage';

/**
 * The round lifecycle (start → summary → retry → home) is wired against a stub
 * mode rather than the registry: what is under test is the app's routing of a
 * finished round, and a real mode would drag its prompt rendering, its voices
 * and its Spanish grading into every click. The stub answers on demand, so
 * "all right" and "all wrong" rounds are both one button away.
 */
vi.mock('@/modes', async () => {
  const { createElement: h } = await import('react');

  const source: QuestionSource = {
    eligibleBuckets: () => ['d0_15'],
    generate: (rng) => {
      const value = rng.int(1, 15);
      return {
        id: `q${value}-${rng.int(1000, 9999)}`,
        bucket: 'd0_15',
        prompt: { kind: 'number', value },
        accepted: { canonical: `numero ${value}`, variants: [{ text: `numero ${value}` }] },
      };
    },
  };

  function Prompt({ question }: PromptProps) {
    const payload = question.prompt;
    return h('span', { 'data-testid': 'prompt' }, payload.kind === 'number' ? payload.value : '?');
  }

  function AnswerZone({ question, verdict, onSubmit }: AnswerZoneProps) {
    const accepted = question.accepted as { canonical: string };
    if (verdict !== null) return null;
    return h(
      'div',
      null,
      h('button', { type: 'button', onClick: () => onSubmit(accepted.canonical) }, 'answer right'),
      h('button', { type: 'button', onClick: () => onSubmit('zzz') }, 'answer wrong'),
    );
  }

  const stubMode = {
    id: 'words',
    titleKey: 'modes.words.title',
    exampleKey: 'modes.words.example',
    requires: [] as const,
    labelKeys: [],
    source,
    Prompt,
    AnswerZone,
  };

  return {
    // The home button plays the composite mode; one stub answers for both so
    // this suite stays about routing rather than about question generation.
    findMode: (id: string) => (id === 'words' || id === 'mixed' ? stubMode : undefined),
    allModes: () => [stubMode],
    MIXED_MODE_ID: 'mixed',
    setMixedAvailability: () => {},
    // The summary prints each missed prompt through the modes layer's formatter.
    promptDisplay: (payload: PromptPayload) =>
      payload.kind === 'number' ? String(payload.value) : '?',
  };
});

const ROUND_SIZE = 10;

function press(name: string | RegExp): void {
  fireEvent.click(screen.getByRole('button', { name }));
}

function promptValue(): string {
  return screen.getByTestId('prompt').textContent ?? '';
}

/** Answer, then let the 120ms prompt swap finish. */
function answer(correctly: boolean): void {
  press(correctly ? 'answer right' : 'answer wrong');
  press('Next');
  act(() => {
    vi.advanceTimersByTime(SWAP_OUT_MS);
  });
}

function playRound(correct: number): void {
  for (let index = 0; index < ROUND_SIZE; index += 1) answer(index < correct);
}

function startRound(): void {
  press(/Start/);
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  initI18n({ initialLang: 'en' });
  updateSettings({ onboarded: true, roundSize: ROUND_SIZE, dailyGoal: 5, soundsEnabled: false });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('App round lifecycle', () => {
  it('carries a finished round into the summary with the day it just stamped', () => {
    render(<App />);
    startRound();
    playRound(ROUND_SIZE);

    expect(screen.getByRole('heading', { name: 'Round complete' })).toBeInTheDocument();
    expect(screen.getByText('10 of 10')).toBeInTheDocument();
    // dayState: the goal (5) was passed by this very round, so the streak
    // starts at one and the stamp is new.
    expect(getProgress().streakCurrent).toBe(1);
    expect(screen.getByText(/best combo ×10/)).toBeInTheDocument();
  });

  it('offers only the misses on retry, and replays exactly those questions', () => {
    render(<App />);
    startRound();

    const missed: string[] = [];
    for (let index = 0; index < ROUND_SIZE; index += 1) {
      if (index >= ROUND_SIZE - 3) missed.push(promptValue());
      answer(index < ROUND_SIZE - 3);
    }

    press('Retry the 3 missed');

    // A retry round is exactly as long as the miss list and replays it in order.
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
    expect(promptValue()).toBe(missed[0]);

    answer(true);
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
    expect(promptValue()).toBe(missed[1]);
  });

  it('finishes a retry into its own summary and returns home', () => {
    render(<App />);
    startRound();
    playRound(0);

    press(`Retry the ${ROUND_SIZE} missed`);
    playRound(ROUND_SIZE);

    expect(screen.getByRole('heading', { name: 'Round complete' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();

    press('Back to home');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/good/i);
    // Home is the root again: nothing is parked and nothing is stacked behind it.
    expect(getRound()).toBeNull();
  });

  it('leaves the round resumable when the learner backs out mid-drill', () => {
    render(<App />);
    startRound();
    answer(true);

    press('Close');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/good/i);
    // The big button starts the mixed round, so that is what stays parked — and
    // a parked mixed round is the one case where the big button continues.
    expect(getRound()?.modeId).toBe('mixed');
    press('Continue · 1 of 10');
    expect(screen.getByText('2 of 10')).toBeInTheDocument();
  });
});
