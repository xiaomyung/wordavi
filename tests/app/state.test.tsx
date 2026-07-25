import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
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
const SETTINGS: Screen = { kind: 'settings' };

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

  it('drops every skipped screen at once on popTo', () => {
    const deep = [DRILL, STATS, SETTINGS].reduce(
      (state, screen) => appReducer(state, { type: 'navigate', screen }),
      initialAppState(HOME),
    );
    expect(stackKinds(appReducer(deep, { type: 'popTo', depth: 2 }))).toEqual(['home', 'drill']);
    expect(stackKinds(appReducer(deep, { type: 'popTo', depth: 1 }))).toEqual(['home']);
  });

  it('clamps a popTo depth the stack cannot honour', () => {
    const shallow = appReducer(initialAppState(HOME), { type: 'navigate', screen: DRILL });
    // A deeper entry outlives the stack that wrote it; it must never grow one.
    expect(appReducer(shallow, { type: 'popTo', depth: 9 })).toBe(shallow);
    expect(stackKinds(appReducer(shallow, { type: 'popTo', depth: 0 }))).toEqual(['home']);
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
      <button type="button" onClick={() => navigate(SETTINGS)}>
        go settings
      </button>
      <button
        type="button"
        onClick={() => navigate({ kind: 'summary', summary: SUMMARY, dayState: DAY_STATE })}
      >
        go summary
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

/**
 * An entry the app does not own, with the entry it will start on above it —
 * what arriving from another page leaves behind. Seeded per test because every
 * test in the file shares one window, and so one history.
 */
function seedForeignEntry(): void {
  window.history.pushState(null, '');
  window.history.pushState(null, '');
}

/** The hardware Back button, `steps` entries at a time. */
function pressBack(steps = 1): void {
  act(() => {
    window.history.go(-steps);
  });
}

/** The entry the browser is sitting on, as the provider marked it. */
function entryMarker(): unknown {
  return window.history.state;
}

/**
 * The marker the provider writes for `depth`. The load token is minted per page
 * load, so a test can only say that one is there — never which.
 */
function ownedEntry(depth: number): unknown {
  return { wordavi: { load: expect.any(String), depth } };
}

/** The load token on the entry the browser is sitting on, if it carries one. */
function loadToken(): unknown {
  return (window.history.state as { wordavi?: { load?: unknown } } | null)?.wordavi?.load;
}

/** An entry marked the way the running provider marks its own, at `depth`. */
function ourEntryState(depth: number): unknown {
  return { wordavi: { load: loadToken(), depth } };
}

/**
 * How a page load that has ended could have marked an entry it owned at `depth`:
 * with a stamp naming itself, or — before the app stamped loads at all — with
 * the bare depth.
 */
const EARLIER_LOAD_MARKERS: readonly (readonly [string, (depth: number) => unknown])[] = [
  ['a load that has ended', (depth) => ({ wordavi: { load: 'earlier-load', depth } })],
  ['a bare depth', (depth) => ({ wordavi: depth })],
];

/** Entries an earlier load left at each of `depths`, oldest first. */
function seedEarlierLoadEntries(mark: (depth: number) => unknown, depths: readonly number[]): void {
  for (const depth of depths) {
    window.history.pushState(mark(depth), '');
  }
}

async function navigateTo(user: ReturnType<typeof userEvent.setup>, ...labels: string[]) {
  for (const label of labels) {
    await user.click(screen.getByText(label));
  }
}

/** Button labels that walk the probe from the root down to depth 4. */
const DESCENT = ['go drill', 'go stats', 'go settings'];

describe('AppStateProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    seedForeignEntry();
  });

  it('throws when the hook is used outside the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/AppStateProvider/);
    consoleError.mockRestore();
  });

  it('claims the entry it starts on', () => {
    renderProbe();
    expect(entryMarker()).toEqual(ownedEntry(1));
  });

  it('mirrors navigation into history.pushState', async () => {
    const pushState = vi.spyOn(window.history, 'pushState');
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByText('go drill'));

    expect(screen.getByTestId('kind')).toHaveTextContent('drill');
    expect(screen.getByTestId('depth')).toHaveTextContent('2');
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(entryMarker()).toEqual(ownedEntry(2));
  });

  it('spends no history entry re-navigating to the visible screen', async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByText('go summary'));
    const entries = window.history.length;

    // Same kind: the reducer updates the payload in place, so history must not
    // grow an entry the learner would have to press through.
    await user.click(screen.getByText('go summary'));
    expect(window.history.length).toBe(entries);
    expect(screen.getByTestId('depth')).toHaveTextContent('2');

    pressBack();
    expect(screen.getByTestId('kind')).toHaveTextContent('home');
  });

  it('walks back one screen per press', async () => {
    const user = userEvent.setup();
    renderProbe();
    await navigateTo(user, ...DESCENT);
    expect(screen.getByTestId('depth')).toHaveTextContent('4');

    for (const [kind, depth] of [
      ['stats', '3'],
      ['drill', '2'],
      ['home', '1'],
    ] as const) {
      pressBack();
      expect(screen.getByTestId('kind')).toHaveTextContent(kind);
      expect(screen.getByTestId('depth')).toHaveTextContent(depth);
    }
  });

  it('walks back one screen per popstate the browser reports', async () => {
    const user = userEvent.setup();
    renderProbe();
    await navigateTo(user, 'go drill', 'go stats');
    expect(screen.getByTestId('depth')).toHaveTextContent('3');

    // A press hands the listener the state of the entry it landed on, and the
    // walk follows that rather than a tally of events: one report, one screen.
    for (const [kind, depth] of [
      ['drill', 2],
      ['home', 1],
    ] as const) {
      const reported = ourEntryState(depth);
      act(() => {
        window.dispatchEvent(new PopStateEvent('popstate', { state: reported }));
      });
      expect(screen.getByTestId('kind')).toHaveTextContent(kind);
      expect(screen.getByTestId('depth')).toHaveTextContent(String(depth));
    }
  });

  it('follows a traversal that skips entries', async () => {
    const user = userEvent.setup();
    renderProbe();
    await navigateTo(user, ...DESCENT);

    // One popstate for the destination, two screens gone.
    pressBack(2);
    expect(screen.getByTestId('kind')).toHaveTextContent('drill');
    expect(screen.getByTestId('depth')).toHaveTextContent('2');

    pressBack();
    expect(screen.getByTestId('kind')).toHaveTextContent('home');
    expect(screen.getByTestId('depth')).toHaveTextContent('1');
  });

  it('never leaves the SPA: a press at the root re-seats our history entry', () => {
    renderProbe();
    const pushState = vi.spyOn(window.history, 'pushState');

    pressBack();

    expect(screen.getByTestId('kind')).toHaveTextContent('home');
    expect(screen.getByTestId('depth')).toHaveTextContent('1');
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(entryMarker()).toEqual(ownedEntry(1));
  });

  it('never leaves the SPA: a popstate carrying no state re-seats the root', () => {
    renderProbe();
    const pushState = vi.spyOn(window.history, 'pushState');

    // An entry nobody wrote state onto reports null, and null is the least our
    // own entries ever look like: there is nothing there to reconcile against.
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.getByTestId('kind')).toHaveTextContent('home');
    expect(screen.getByTestId('depth')).toHaveTextContent('1');
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(entryMarker()).toEqual(ownedEntry(1));
  });

  it('holds the root against repeated presses', () => {
    renderProbe();

    pressBack();
    pressBack();

    expect(screen.getByTestId('kind')).toHaveTextContent('home');
    expect(screen.getByTestId('depth')).toHaveTextContent('1');
    expect(entryMarker()).toEqual(ownedEntry(1));
  });

  it('does not pop twice for the traversal its own back() causes', async () => {
    const user = userEvent.setup();
    renderProbe();
    await navigateTo(user, 'go drill', 'go stats');
    await user.click(screen.getByText('go back'));

    expect(screen.getByTestId('kind')).toHaveTextContent('drill');
    expect(screen.getByTestId('depth')).toHaveTextContent('2');
    expect(entryMarker()).toEqual(ownedEntry(2));
  });

  it('moves nothing when the traversal reports itself twice', async () => {
    const user = userEvent.setup();
    renderProbe();
    await navigateTo(user, 'go drill', 'go stats');
    await user.click(screen.getByText('go back'));

    // Browsers run history.go() asynchronously, so its popstate can arrive after
    // the app has already reconciled against the entry it landed on. A second
    // report of the same entry is not a second press.
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    });

    expect(screen.getByTestId('kind')).toHaveTextContent('drill');
    expect(screen.getByTestId('depth')).toHaveTextContent('2');
    expect(entryMarker()).toEqual(ownedEntry(2));
  });

  it.each([
    [2, ['go drill']],
    [3, ['go drill', 'go stats']],
    [4, DESCENT],
  ] as const)('resets to a single screen from depth %i', async (depth, labels) => {
    const user = userEvent.setup();
    renderProbe();
    await navigateTo(user, ...labels);
    expect(screen.getByTestId('depth')).toHaveTextContent(String(depth));

    const go = vi.spyOn(window.history, 'go');
    await user.click(screen.getByText('go root'));

    expect(screen.getByTestId('kind')).toHaveTextContent('home');
    expect(screen.getByTestId('depth')).toHaveTextContent('1');
    expect(go).toHaveBeenCalledWith(1 - depth);
    expect(entryMarker()).toEqual(ownedEntry(1));
  });

  it('leaves history alone when reset is already at the root', async () => {
    const user = userEvent.setup();
    renderProbe();
    const go = vi.spyOn(window.history, 'go');
    const pushState = vi.spyOn(window.history, 'pushState');

    await user.click(screen.getByText('go root'));

    expect(go).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
    expect(entryMarker()).toEqual(ownedEntry(1));
  });

  it.each([2, 3, 4] as const)('honours the press after a reset from depth %i', async (depth) => {
    const user = userEvent.setup();
    renderProbe();
    await navigateTo(user, ...DESCENT.slice(0, depth - 1));
    await user.click(screen.getByText('go root'));

    // A multi-entry rewind fires one popstate, not one per entry: a press that
    // arrives afterwards is the learner's, and must re-seat the root rather than
    // spend the entry that stands between them and leaving the app.
    pressBack();

    expect(screen.getByTestId('kind')).toHaveTextContent('home');
    expect(screen.getByTestId('depth')).toHaveTextContent('1');
    expect(entryMarker()).toEqual(ownedEntry(1));
  });

  it('lands on the root when a traversal skips past every entry we own', async () => {
    const user = userEvent.setup();
    renderProbe();
    await navigateTo(user, ...DESCENT);

    // Straight past our four entries onto the page the learner arrived from.
    pressBack(4);

    expect(screen.getByTestId('kind')).toHaveTextContent('home');
    expect(screen.getByTestId('depth')).toHaveTextContent('1');
    expect(entryMarker()).toEqual(ownedEntry(1));
  });

  it('ignores an entry pushed by someone else', async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByText('go drill'));

    act(() => {
      window.history.pushState(null, '');
    });
    pressBack();

    // The press only undid the foreign entry; the app is where it was.
    expect(screen.getByTestId('kind')).toHaveTextContent('drill');
    expect(screen.getByTestId('depth')).toHaveTextContent('2');

    pressBack();
    expect(screen.getByTestId('kind')).toHaveTextContent('home');
  });

  it.each(EARLIER_LOAD_MARKERS)(
    'does not adopt the depth on an entry left by an earlier page load: %s',
    (_label, mark) => {
      // A reload at depth 3: the entry it lands on becomes this load's root, and
      // the two below it still describe the stack that died with the old document.
      seedEarlierLoadEntries(mark, [2, 3]);
      renderProbe();
      expect(entryMarker()).toEqual(ownedEntry(1));

      const pushState = vi.spyOn(window.history, 'pushState');
      pressBack();

      // Spent like any other site's entry, and the app holds the newest entry
      // again — never a seat below its own, which is where a press could leave.
      expect(screen.getByTestId('kind')).toHaveTextContent('home');
      expect(screen.getByTestId('depth')).toHaveTextContent('1');
      expect(pushState).toHaveBeenCalledTimes(1);
      expect(entryMarker()).toEqual(ownedEntry(1));
    },
  );

  it.each(EARLIER_LOAD_MARKERS)(
    'never swallows a press onto an entry an earlier page load owned deeper: %s',
    async (_label, mark) => {
      const user = userEvent.setup();
      // A reload at depth 6 leaves entries whose depths outrank anything the new
      // document owns until the learner navigates that far again.
      seedEarlierLoadEntries(mark, [1, 2, 3, 4, 5, 6]);
      renderProbe();
      await navigateTo(user, ...DESCENT);
      expect(screen.getByTestId('depth')).toHaveTextContent('4');

      // A long press: past the four entries this load owns, onto one of theirs.
      pressBack(4);

      expect(screen.getByTestId('kind')).toHaveTextContent('home');
      expect(screen.getByTestId('depth')).toHaveTextContent('1');
      expect(entryMarker()).toEqual(ownedEntry(1));

      // The entries they left are not a queue of presses to absorb: the next
      // screen the learner opens still walks back on the very first press.
      await user.click(screen.getByText('go drill'));
      expect(screen.getByTestId('depth')).toHaveTextContent('2');
      pressBack();
      expect(screen.getByTestId('kind')).toHaveTextContent('home');
      expect(screen.getByTestId('depth')).toHaveTextContent('1');
    },
  );

  it('stamps one load token on every entry it owns', async () => {
    const user = userEvent.setup();
    renderProbe();
    const token = loadToken();
    expect(token).toEqual(expect.any(String));

    // One token for the life of the page, so the app keeps recognising the
    // entries it pushed earlier however far the learner walks.
    await navigateTo(user, ...DESCENT);
    expect(loadToken()).toBe(token);
    pressBack(2);
    expect(loadToken()).toBe(token);
  });

  it('spends no extra entry under a double mount', async () => {
    const user = userEvent.setup();
    const entries = window.history.length;
    render(
      // What StrictMode does in development: mount, tear down, mount again.
      <StrictMode>
        <AppStateProvider initial={HOME}>
          <Probe />
        </AppStateProvider>
      </StrictMode>,
    );

    expect(window.history.length).toBe(entries);
    const token = loadToken();
    await user.click(screen.getByText('go drill'));
    expect(window.history.length).toBe(entries + 1);
    expect(entryMarker()).toEqual(ownedEntry(2));
    // The second mount claims what the first one did, rather than disowning it.
    expect(loadToken()).toBe(token);

    pressBack();
    expect(screen.getByTestId('kind')).toHaveTextContent('home');
    expect(screen.getByTestId('depth')).toHaveTextContent('1');
  });

  it('re-labels a forward entry whose screen is gone', async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByText('go drill'));
    pressBack();

    act(() => {
      window.history.forward();
    });

    // Nothing to go forward *to*: a popped screen is not kept around.
    expect(screen.getByTestId('kind')).toHaveTextContent('home');
    expect(screen.getByTestId('depth')).toHaveTextContent('1');
    expect(entryMarker()).toEqual(ownedEntry(1));
  });
});
