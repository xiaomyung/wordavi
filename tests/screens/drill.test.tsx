import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { init as initI18n } from '@/i18n';
import type { AnswerZoneProps, PromptProps } from '@/modes';
import { DrillScreen } from '@/screens/DrillScreen';
import { SWAP_OUT_MS } from '@/screens/drill/useDrillRound';
import type { QuestionSource, RoundSummary } from '@/session';
import type { SavedRound } from '@/storage';
import { clearRound, getRound, getSrs, updateSettings } from '@/storage';

/**
 * The drill is exercised against a stub mode rather than the real registry: this
 * suite is about the round lifecycle (grading, swap, persistence, finish), and a
 * real mode would drag its own prompt rendering and TTS into every assertion.
 * The stub exposes each prop the contract promises as a DOM node, so the props
 * the drill passes down are asserted, not assumed.
 */
vi.mock('@/modes', async () => {
  const { createElement: h, useState } = await import('react');

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

  function Prompt({ question, slower, onToggleSlower }: PromptProps) {
    const payload = question.prompt;
    return h(
      'div',
      null,
      h('span', { 'data-testid': 'prompt' }, payload.kind === 'number' ? payload.value : '?'),
      h('button', { type: 'button', onClick: onToggleSlower }, slower ? 'slower-on' : 'slower-off'),
    );
  }

  function AnswerZone({
    question,
    verdict,
    expectedDisplay,
    onSubmit,
    micDenied,
    onMicDenied,
    labels,
  }: AnswerZoneProps) {
    const [typed, setTyped] = useState('');
    const accepted = question.accepted as { canonical: string };
    return h(
      'div',
      null,
      h('input', {
        'aria-label': 'answer',
        value: typed,
        readOnly: verdict !== null,
        onChange: (event: { target: { value: string } }) => setTyped(event.target.value),
      }),
      h('span', { 'data-testid': 'expected' }, verdict === null ? '' : expectedDisplay),
      h('span', { 'data-testid': 'mic-denied' }, String(micDenied)),
      h('span', { 'data-testid': 'label-check' }, labels['common.check'] ?? ''),
      verdict === null
        ? h(
            'button',
            { type: 'button', onClick: () => onSubmit(accepted.canonical) },
            'answer right',
          )
        : null,
      verdict === null
        ? h('button', { type: 'button', onClick: () => onSubmit('zzz') }, 'answer wrong')
        : null,
      h('button', { type: 'button', onClick: onMicDenied }, 'deny mic'),
    );
  }

  const stubMode = {
    id: 'words',
    titleKey: 'modes.words.title',
    exampleKey: 'modes.words.example',
    requires: [] as const,
    labelKeys: ['common.check'],
    source,
    Prompt,
    AnswerZone,
  };

  return {
    findMode: (id: string) => (id === 'stub' ? stubMode : undefined),
    allModes: () => [stubMode],
  };
});

const MODE_ID = 'stub';

function setSearch(search: string): void {
  window.history.replaceState({}, '', `/${search}`);
}

function promptValue(): string {
  return screen.getByTestId('prompt').textContent ?? '';
}

function press(name: string): void {
  fireEvent.click(screen.getByRole('button', { name }));
}

function answerRight(): void {
  press('answer right');
}

/** Press "Дальше" and let the 120ms swap-out run to completion. */
function goNext(): void {
  press('Дальше');
  act(() => {
    vi.advanceTimersByTime(SWAP_OUT_MS);
  });
}

function renderDrill(
  overrides: { resume?: SavedRound; onFinish?: (s: RoundSummary) => void } = {},
) {
  const onFinish = overrides.onFinish ?? vi.fn();
  const onExit = vi.fn();
  const view = render(
    <DrillScreen
      modeId={MODE_ID}
      {...(overrides.resume !== undefined ? { resume: overrides.resume } : {})}
      onFinish={onFinish}
      onExit={onExit}
    />,
  );
  return { ...view, onFinish, onExit };
}

describe('DrillScreen', () => {
  beforeEach(() => {
    localStorage.clear();
    setSearch('');
    initI18n({ initialLang: 'ru' });
    updateSettings({ roundSize: 10, soundsEnabled: false, rangeMin: 0, rangeMax: 100 });
    // The only timer the drill schedules is the 120ms question swap; every
    // interaction below is a synchronous, act-wrapped fireEvent.
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    setSearch('');
  });

  it('renders the shared skeleton: progress, counter, score row and mode overline', () => {
    renderDrill();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('1 из 10')).toBeInTheDocument();
    expect(screen.getByText('очков')).toBeInTheDocument();
    // The overline splits on the arrow so it can be accented (mockups).
    expect(screen.getByText('→')).toBeInTheDocument();
    expect(screen.getByTestId('label-check')).toHaveTextContent('Проверить');
  });

  it('grades an answer, shows the verdict, then swaps in the next question', () => {
    renderDrill();
    const first = promptValue();

    answerRight();

    expect(screen.getByText('¡Muy bien!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Дальше' })).toBeInTheDocument();
    // The answer zone freezes rather than being punished away.
    expect(screen.getByLabelText('answer')).toHaveAttribute('readonly');

    goNext();

    expect(screen.queryByText('¡Muy bien!')).not.toBeInTheDocument();
    expect(screen.getByText('2 из 10')).toBeInTheDocument();
    expect(promptValue()).not.toBe('');
    expect(first).not.toBe('');
  });

  it('reveals the right answer on a wrong verdict without punishing the learner', () => {
    renderDrill();
    press('answer wrong');

    const expected = screen.getByTestId('expected').textContent ?? '';
    expect(expected).toMatch(/^numero \d+$/);
    expect(screen.getByText(`Правильно: ${expected}`)).toBeInTheDocument();
    expect(screen.getByText('бывает, ещё встретится')).toBeInTheDocument();
  });

  it('ticks the score and combo chips as answers land', () => {
    renderDrill();

    answerRight();
    expect(screen.getByText('10')).toBeInTheDocument();
    // A combo only becomes worth showing at two in a row.
    expect(screen.queryByText('×2')).not.toBeInTheDocument();

    goNext();
    answerRight();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('×2')).toBeInTheDocument();
  });

  it('runs a fixed round to the end and reports the summary', () => {
    const onFinish = vi.fn();
    renderDrill({ onFinish });

    for (let i = 0; i < 10; i += 1) {
      answerRight();
      goNext();
    }

    expect(onFinish).toHaveBeenCalledTimes(1);
    const summary = onFinish.mock.calls[0]?.[0] as RoundSummary;
    expect(summary.total).toBe(10);
    expect(summary.correctCount).toBe(10);
    expect(summary.wrongCount).toBe(0);
    expect(summary.points).toBe(100);
    expect(summary.bestCombo).toBe(10);
    // A finished round leaves nothing to resume.
    expect(getRound()).toBeNull();
  });

  it('persists the round and the SRS after every answer', () => {
    renderDrill();
    expect(getRound()).toBeNull();

    answerRight();

    const saved = getRound();
    expect(saved?.modeId).toBe(MODE_ID);
    expect(getSrs()).not.toBeNull();
    const state = saved?.state as { records: unknown[]; served: unknown[] };
    expect(state.records).toHaveLength(1);
    expect(state.served).toHaveLength(1);
  });

  it('resumes a saved round at the same question', () => {
    const first = renderDrill();
    answerRight();
    goNext();

    const shown = promptValue();
    expect(screen.getByText('2 из 10')).toBeInTheDocument();
    first.unmount();

    const saved = getRound();
    expect(saved).not.toBeNull();
    if (saved === null) throw new Error('expected a saved round');

    renderDrill({ resume: saved });
    expect(promptValue()).toBe(shown);
    expect(screen.getByText('2 из 10')).toBeInTheDocument();
  });

  it('replays an identical first question for the same ?seed', () => {
    setSearch('?seed=4242');

    const first = renderDrill();
    const firstPrompt = promptValue();
    first.unmount();

    clearRound();
    localStorage.removeItem('wordavi:srs');

    renderDrill();
    expect(promptValue()).toBe(firstPrompt);
  });

  it('counts against infinity and finishes from the close button when endless', () => {
    updateSettings({ roundSize: 'endless' });
    const onFinish = vi.fn();
    renderDrill({ onFinish });

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('1 · ∞')).toBeInTheDocument();

    answerRight();
    goNext();
    expect(screen.getByText('2 · ∞')).toBeInTheDocument();

    press('Завершить раунд');

    expect(onFinish).toHaveBeenCalledTimes(1);
    const summary = onFinish.mock.calls[0]?.[0] as RoundSummary;
    expect(summary.size).toBe('endless');
    expect(summary.total).toBe(1);
  });

  it('leaves a fixed round resumable when the learner backs out', () => {
    const { onExit, onFinish } = renderDrill();
    answerRight();
    goNext();

    press('Закрыть');

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onFinish).not.toHaveBeenCalled();
    expect(getRound()).not.toBeNull();
  });

  it('keeps the slower setting sticky across the round', () => {
    renderDrill();
    expect(screen.getByRole('button', { name: 'slower-off' })).toBeInTheDocument();

    press('slower-off');
    expect(screen.getByRole('button', { name: 'slower-on' })).toBeInTheDocument();

    answerRight();
    goNext();
    expect(screen.getByRole('button', { name: 'slower-on' })).toBeInTheDocument();
  });

  it('surfaces a denied microphone to the answer zone', () => {
    renderDrill();
    expect(screen.getByTestId('mic-denied')).toHaveTextContent('false');

    press('deny mic');
    expect(screen.getByTestId('mic-denied')).toHaveTextContent('true');
  });

  it('renders nothing for an unknown mode instead of a broken drill', () => {
    const { container } = render(
      <DrillScreen modeId="not-a-mode" onFinish={vi.fn()} onExit={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
