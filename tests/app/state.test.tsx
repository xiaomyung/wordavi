import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState, Screen } from '@/app/state';
import {
  AppStateProvider,
  appReducer,
  currentScreen,
  initialAppState,
  useAppState,
} from '@/app/state';
import type { SummaryDayState } from '@/screens/SummaryScreen';
import type { RoundSummary } from '@/session';

const HOME: Screen = { kind: 'home' };
const DRILL: Screen = { kind: 'drill' };
const STATS: Screen = { kind: 'stats' };

const SUMMARY: RoundSummary = {
  modeId: 'words',
  size: 10,
  total: 10,
  correctCount: 9,
  almostCount: 1,
  wrongCount: 1,
  accuracy: 0.9,
  points: 96,
  bestCombo: 5,
  verdicts: [],
  missed: [],
};

const DAY_STATE: SummaryDayState = {
  goalMet: true,
  stampedToday: false,
  streakDays: 1,
  done: 9,
  total: 20,
};

function stackKinds(state: AppState): string[] {
  return state.stack.map((screen) => screen.kind);
}

describe('appReducer', () => {
  it('starts on the given screen', () => {
    expect(stackKinds(initialAppState(STATS))).toEqual(['stats']);
    expect(currentScreen(initialAppState())).toEqual(HOME);
  });

  it('pushes on navigate', () => {
    const state = appReducer(initialAppState(HOME), { type: 'navigate', screen: DRILL });
    expect(stackKinds(state)).toEqual(['home', 'drill']);
    expect(currentScreen(state)).toEqual(DRILL);
  });

  it('replaces rather than stacking a duplicate of the visible screen', () => {
    const first = appReducer(initialAppState(HOME), {
      type: 'navigate',
      screen: { kind: 'summary', summary: SUMMARY, dayState: DAY_STATE },
    });
    const second = appReducer(first, {
      type: 'navigate',
      screen: { kind: 'summary', summary: { ...SUMMARY, points: 10 }, dayState: DAY_STATE },
    });

    expect(stackKinds(second)).toEqual(['home', 'summary']);
    const top = currentScreen(second);
    expect(top.kind === 'summary' && top.summary.points).toBe(10);
  });

  it('pops on back and stays put at the root', () => {
    const pushed = appReducer(initialAppState(HOME), { type: 'navigate', screen: DRILL });
    const popped = appReducer(pushed, { type: 'back' });
    expect(stackKinds(popped)).toEqual(['home']);

    // The app owns its history: back at the root is identity, never an unmount.
    expect(appReducer(popped, { type: 'back' })).toBe(popped);
  });

  it('swaps the visible screen on replace without growing the stack', () => {
    const pushed = appReducer(initialAppState(HOME), { type: 'navigate', screen: DRILL });
    const replaced = appReducer(pushed, { type: 'replace', screen: STATS });
    expect(stackKinds(replaced)).toEqual(['home', 'stats']);
  });

  it('collapses the stack on reset', () => {
    const deep = [DRILL, STATS].reduce(
      (state, screen) => appReducer(state, { type: 'navigate', screen }),
      initialAppState(HOME),
    );
    expect(stackKinds(deep)).toEqual(['home', 'drill', 'stats']);
    expect(stackKinds(appReducer(deep, { type: 'reset', screen: HOME }))).toEqual(['home']);
  });
});

function Probe() {
  const { screen: current, depth, navigate, back, reset } = useAppState();
  return (
    <div>
      <span data-testid="kind">{current.kind}</span>
      <span data-testid="depth">{depth}</span>
      <button type="button" onClick={() => navigate(DRILL)}>
        go drill
      </button>
      <button type="button" onClick={() => navigate(STATS)}>
        go stats
      </button>
      <button type="button" onClick={back}>
        go back
      </button>
      <button type="button" onClick={() => reset(HOME)}>
        go root
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <AppStateProvider initial={HOME}>
      <Probe />
    </AppStateProvider>,
  );
}

describe('AppStateProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when the hook is used outside the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/AppStateProvider/);
    consoleError.mockRestore();
  });

  it('mirrors navigation into history.pushState', async () => {
    const pushState = vi.spyOn(window.history, 'pushState');
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByText('go drill'));

    expect(screen.getByTestId('kind')).toHaveTextContent('drill');
    expect(screen.getByTestId('depth')).toHaveTextContent('2');
    expect(pushState).toHaveBeenCalled();
  });

  it('walks back one screen per popstate', async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByText('go drill'));
    await user.click(screen.getByText('go stats'));
    expect(screen.getByTestId('depth')).toHaveTextContent('3');

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByTestId('kind')).toHaveTextContent('drill');

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByTestId('kind')).toHaveTextContent('home');
    expect(screen.getByTestId('depth')).toHaveTextContent('1');
  });

  it('never leaves the SPA: popstate at the root re-seats our history entry', async () => {
    renderProbe();
    const pushState = vi.spyOn(window.history, 'pushState');

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.getByTestId('kind')).toHaveTextContent('home');
    expect(screen.getByTestId('depth')).toHaveTextContent('1');
    expect(pushState).toHaveBeenCalledTimes(1);
  });

  it('ignores the popstate its own back() causes', async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByText('go drill'));
    await user.click(screen.getByText('go back'));
    expect(screen.getByTestId('kind')).toHaveTextContent('home');

    // history.back() is async; the event it eventually fires must not pop twice.
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByTestId('kind')).toHaveTextContent('home');
    expect(screen.getByTestId('depth')).toHaveTextContent('1');
  });

  it('resets to a single screen and rewinds the matching history entries', async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByText('go drill'));
    await user.click(screen.getByText('go stats'));

    const go = vi.spyOn(window.history, 'go');
    await user.click(screen.getByText('go root'));

    expect(screen.getByTestId('kind')).toHaveTextContent('home');
    expect(screen.getByTestId('depth')).toHaveTextContent('1');
    expect(go).toHaveBeenCalledWith(-2);
  });
});
