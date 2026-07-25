/**
 * Screen state machine for the app shell.
 *
 * There is no router in v1 (see docs/architecture/layers): the current screen is a tagged union
 * held in a small stack, so "back" is a pop rather than a URL parse. The stack is
 * mirrored into `history` with a pushState shim so the hardware/browser Back
 * button walks the same path — and never falls out of the SPA at the root.
 */
import type { ReactNode } from 'react';
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import type { SummaryDayState } from '@/screens/SummaryScreen';
import type { RoundSummary } from '@/session';

export type Screen =
  | { kind: 'home' }
  /**
   * `modeId` is the mode to play — carried by the navigation rather than read
   * back from settings, because the big start button plays the mixed mode
   * without making it the learner's "last mode". `retryOf` replays that
   * summary's misses instead of a fresh round.
   */
  | { kind: 'drill'; modeId?: string; retryOf?: RoundSummary }
  /**
   * The day state is sampled when the round ends, not when the screen renders:
   * "was the stamp already earned?" is unanswerable once the round is folded in.
   */
  | { kind: 'summary'; summary: RoundSummary; dayState: SummaryDayState }
  | { kind: 'settings' }
  | { kind: 'stats' }
  | { kind: 'onboarding' }
  | { kind: 'report' }
  | { kind: 'gallery' }
  | { kind: 'crash' };

export type ScreenKind = Screen['kind'];

export interface AppState {
  /** Never empty; the last entry is the visible screen. */
  stack: readonly Screen[];
}

export type AppAction =
  /** Push a screen (replaces the top when it is the same kind, so Back stays sane). */
  | { type: 'navigate'; screen: Screen }
  /** Swap the visible screen without growing the stack. */
  | { type: 'replace'; screen: Screen }
  /** Pop one screen; a no-op at the root. */
  | { type: 'back' }
  /**
   * Drop to `depth` screens at once. A browser traversal can skip several
   * entries in a single move (a long-press on Back, a jump in the history
   * menu), which lands the app several screens up rather than one.
   */
  | { type: 'popTo'; depth: number }
  /** Collapse the stack down to a single screen (used for "go home"). */
  | { type: 'reset'; screen: Screen };

export function initialAppState(screen: Screen = { kind: 'home' }): AppState {
  return { stack: [screen] };
}

export function currentScreen(state: AppState): Screen {
  // The stack is never empty by construction; the fallback keeps the type honest.
  return state.stack.at(-1) ?? { kind: 'home' };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'navigate': {
      // Re-navigating to the screen already on top updates its payload in place
      // rather than stacking a duplicate the learner would have to Back through.
      if (currentScreen(state).kind === action.screen.kind) {
        return { stack: [...state.stack.slice(0, -1), action.screen] };
      }
      return { stack: [...state.stack, action.screen] };
    }
    case 'replace':
      return { stack: [...state.stack.slice(0, -1), action.screen] };
    case 'back':
      // Identity at the root: the app owns its history and never unmounts itself.
      return state.stack.length <= 1 ? state : { stack: state.stack.slice(0, -1) };
    case 'popTo': {
      // Clamped rather than trusted: the depth is read off a history entry, and
      // history is edited by the browser as much as by the app.
      const depth = Math.min(Math.max(action.depth, 1), state.stack.length);
      return depth === state.stack.length ? state : { stack: state.stack.slice(0, depth) };
    }
    case 'reset':
      return { stack: [action.screen] };
  }
}

/* ------------------------------------------------------------------ *
 * History mirroring
 * ------------------------------------------------------------------ */

/** Marker on our own history entries, so foreign entries are easy to tell apart. */
const HISTORY_MARKER = 'wordavi';

/**
 * Which page load an entry was written by. History outlives the document: a
 * reload or a restored tab leaves entries whose depth describes a stack that
 * died with the load that wrote it, and one of those read as ours costs the
 * learner the press that lands on it. Minted at module scope, so every mount of
 * the provider in one load — StrictMode's second one included — claims the same
 * entries; the clock keeps two loads apart even if the random half repeats.
 */
const LOAD_ID = `${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}`;

interface HistoryEntryMarker {
  load: string;
  depth: number;
}

interface HistoryEntryState {
  [HISTORY_MARKER]: HistoryEntryMarker;
}

function historyAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.history?.pushState === 'function';
}

function entryState(depth: number): HistoryEntryState {
  return { [HISTORY_MARKER]: { load: LOAD_ID, depth } };
}

/**
 * The stack depth an entry stands for, or null when the entry is not this
 * load's. An earlier load's entry counts as foreign exactly like another site's:
 * both sit below everything the running app owns.
 */
function entryDepth(state: unknown): number | null {
  if (typeof state !== 'object' || state === null) return null;
  const marker: unknown = (state as Partial<HistoryEntryState>)[HISTORY_MARKER];
  if (typeof marker !== 'object' || marker === null) return null;
  const { load, depth } = marker as Partial<HistoryEntryMarker>;
  if (load !== LOAD_ID) return null;
  return typeof depth === 'number' && Number.isInteger(depth) && depth >= 1 ? depth : null;
}

/* ------------------------------------------------------------------ *
 * Context
 * ------------------------------------------------------------------ */

export interface AppStateValue {
  screen: Screen;
  /** Stack depth; 1 means the root screen is visible. */
  depth: number;
  navigate: (screen: Screen) => void;
  replace: (screen: Screen) => void;
  back: () => void;
  reset: (screen: Screen) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export interface AppStateProviderProps {
  initial?: Screen;
  children: ReactNode;
}

export function AppStateProvider({ initial, children }: AppStateProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initial, initialAppState);
  const depth = state.stack.length;

  // How many history entries we own — always the depth marked on the newest of
  // them. Kept in a ref (not state) because the popstate listener must read the
  // live value without re-subscribing, and because it is what the two mirroring
  // directions below hand each other.
  const ownedDepthRef = useRef(1);

  useEffect(() => {
    if (!historyAvailable()) return;
    // The entry the app opened on becomes its root, whatever it held before —
    // after a reload that is an entry an earlier load owned at some depth.
    window.history.replaceState(entryState(1), '');

    /**
     * History moved under us, so the entry we landed on decides how deep the
     * app is. It is read rather than counted because a single traversal can
     * skip several entries and still fire exactly one popstate — for the
     * destination — so a tally of expected events drifts by everything skipped
     * and swallows that many later presses.
     */
    const onPopState = (event: PopStateEvent): void => {
      const owned = ownedDepthRef.current;
      const target = entryDepth(event.state);
      if (target === null) {
        // An entry this load does not own: the page the learner arrived from, or
        // one an earlier load left behind. Either sits below every entry we own —
        // so the traversal went past all of them and the app belongs at its root.
        // Claim the top back rather than let the next press leave: an installed
        // PWA has no address bar to come back from.
        window.history.pushState(entryState(1), '');
        ownedDepthRef.current = 1;
        dispatch({ type: 'popTo', depth: 1 });
        return;
      }
      if (target > owned) {
        // Forward into an entry whose screen was dropped when it was popped;
        // only the visible one survives. Re-label it as what is on screen.
        window.history.replaceState(entryState(owned), '');
        return;
      }
      // A traversal we asked for lands exactly where we already are.
      if (target === owned) return;
      ownedDepthRef.current = target;
      dispatch({ type: 'popTo', depth: target });
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Mirror the stack into history whenever the app moved on its own. A move that
  // came *from* history has already left the ref matching the stack, so this
  // sees nothing to do — which is what stops the two directions fighting over
  // the same entries. Batched navigations (reset then push, on the way out of
  // onboarding) settle into one render, so history gets one edit, not a race.
  useEffect(() => {
    if (!historyAvailable()) return;
    const owned = ownedDepthRef.current;
    if (depth === owned) return;
    ownedDepthRef.current = depth;
    if (depth < owned) {
      window.history.go(depth - owned);
      return;
    }
    for (let d = owned + 1; d <= depth; d += 1) {
      window.history.pushState(entryState(d), '');
    }
  }, [depth]);

  const navigate = useCallback((screen: Screen) => {
    dispatch({ type: 'navigate', screen });
  }, []);

  const replace = useCallback((screen: Screen) => {
    dispatch({ type: 'replace', screen });
  }, []);

  const back = useCallback(() => {
    dispatch({ type: 'back' });
  }, []);

  const reset = useCallback((screen: Screen) => {
    dispatch({ type: 'reset', screen });
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({
      screen: currentScreen(state),
      depth,
      navigate,
      replace,
      back,
      reset,
    }),
    [state, depth, navigate, replace, back, reset],
  );

  return createElement(AppStateContext.Provider, { value }, children);
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (value === null) {
    throw new Error('useAppState: must be used inside <AppStateProvider>');
  }
  return value;
}
