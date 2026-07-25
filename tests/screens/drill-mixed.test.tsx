import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { init as initI18n } from '@/i18n';
import { DrillScreen } from '@/screens/DrillScreen';
import { SWAP_OUT_MS } from '@/screens/drill/useDrillRound';
import type { RoundSummary } from '@/session';
import { getRound, updateSettings } from '@/storage';

/**
 * The composite mode inside the real drill — no mode stubs here: the point is
 * that the screen swaps prompt zone, answer zone and overline per question and
 * still runs one round.
 *
 * The mix is pinned to the three written modes (words, digits, choice) the way
 * the app pins it — through the `availableModeIds` prop — because that is
 * exactly the mixture that makes the drill change answer *type* mid-round. The
 * voice probes are stubbed too, so nothing reaches for a synthesiser happy-dom
 * does not have.
 */
vi.mock('@/services/tts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/tts')>();
  return { ...actual, getVoiceStatus: () => 'none' as const, speak: () => Promise.resolve() };
});

vi.mock('@/services/speech', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/speech')>();
  return { ...actual, isRecognitionSupported: () => false };
});

const ROUND_SIZE = 10;

/** The modes a voice-less browser can run — what the app would hand the drill. */
const WRITTEN_MODE_IDS = ['words', 'digits', 'choice'] as const;

/** RU titles of those same three modes. */
const WRITTEN_TITLES = ['Число → словами', 'Слова → число', 'Выбор из четырёх'];

function setSearch(search: string): void {
  window.history.replaceState({}, '', `/${search}`);
}

function overline(): string {
  return screen.getByTestId('mode-overline').textContent ?? '';
}

/** The 2x2 choice tiles: buttons whose whole name is an es-ES numeral. */
function choiceTiles(): HTMLElement[] {
  return screen
    .getAllByRole('button')
    .filter((button) => /^[\d ]+$/.test(button.textContent ?? ''));
}

/**
 * Answer whatever is on stage, wrongly — the one path every written mode
 * shares. The verdict is beside the point here; the swap is what is under test.
 */
function answerAnything(): void {
  const field = screen.queryByRole('textbox');
  if (field === null) {
    const tile = choiceTiles()[0];
    if (tile === undefined) throw new Error('no answer zone on stage');
    fireEvent.click(tile);
  } else {
    fireEvent.change(field, { target: { value: 'zzz' } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
}

function goNext(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));
  act(() => {
    vi.advanceTimersByTime(SWAP_OUT_MS);
  });
}

function renderMixed(onFinish = vi.fn()) {
  render(
    <DrillScreen
      modeId="mixed"
      availableModeIds={WRITTEN_MODE_IDS}
      onFinish={onFinish}
      onExit={vi.fn()}
    />,
  );
  return onFinish;
}

beforeEach(() => {
  localStorage.clear();
  setSearch('?seed=2026');
  initI18n({ initialLang: 'ru' });
  updateSettings({ roundSize: ROUND_SIZE, soundsEnabled: false, rangeMin: 0, rangeMax: 100 });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  setSearch('');
});

describe('DrillScreen · mixed round', () => {
  it('names the mode of every question and keeps the round visibly mixed', () => {
    renderMixed();

    const titles: string[] = [];
    for (let step = 1; step <= ROUND_SIZE; step += 1) {
      expect(screen.getByText(`${step} из ${ROUND_SIZE}`)).toBeInTheDocument();
      titles.push(overline());
      answerAnything();
      goNext();
    }

    // Every overline is a real mode title — never the composite's own.
    for (const title of titles) expect(WRITTEN_TITLES).toContain(title);
    expect(new Set(titles).size).toBeGreaterThan(1);
    // Fresh questions never repeat a mode back to back (mixed.test.tsx proves
    // that directly); a due wrongQueue item replays whatever mode it came from,
    // so the round-level promise is the weaker "never three in a row".
    for (let i = 2; i < titles.length; i += 1) {
      expect([titles[i - 2], titles[i - 1], titles[i]], `questions ${i - 1}–${i + 1}`).not.toEqual([
        titles[i],
        titles[i],
        titles[i],
      ]);
    }
  });

  it('answers across a change of answer type and finishes one round', () => {
    const onFinish = renderMixed();

    const zones: string[] = [];
    for (let step = 1; step <= ROUND_SIZE; step += 1) {
      zones.push(screen.queryByRole('textbox') === null ? 'choice' : 'typed');
      answerAnything();
      // The verdict lands whatever the zone was.
      expect(screen.getByRole('button', { name: 'Дальше' })).toBeInTheDocument();
      goNext();
    }

    // The round really did swap answer types, not just prompts.
    expect(new Set(zones).size).toBe(2);
    expect(onFinish).toHaveBeenCalledTimes(1);
    const summary = onFinish.mock.calls[0]?.[0] as RoundSummary;
    expect(summary.modeId).toBe('mixed');
    expect(summary.total).toBe(ROUND_SIZE);
    // A finished round leaves nothing parked.
    expect(getRound()).toBeNull();
  });

  it('parks the unfinished round under the composite mode', () => {
    const view = renderMixed();
    expect(view).toBeDefined();
    answerAnything();

    expect(getRound()?.modeId).toBe('mixed');
  });
});
