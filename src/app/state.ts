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
    case 'reset':
      return { stack: [action.screen] };
  }
}

/* ------------------------------------------------------------------ *
 * History mirroring
 * ------------------------------------------------------------------ */

/** Marker on our own history entries, so foreign entries are easy to tell apart. */
const HISTORY_MARKER = 'wordavi';

interface HistoryEntryState {
  [HISTORY_MARKER]: number;
}

function historyAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.history?.pushState === 'function';
}

function entryState(depth: number): HistoryEntryState {
  return { [HISTORY_MARKER]: depth };
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

  // Depth of the history stack we own. Kept in a ref (not state) because the
  // popstate listener must read the live value without re-subscribing.
  const depthRef = useRef(1);
  // Number of upcoming popstate events that we caused ourselves and must ignore
  // — the state change has already been dispatched by the time they arrive.
  const selfPopsRef = useRef(0);

  useEffect(() => {
    if (!historyAvailable()) return;
    window.history.replaceState(entryState(1), '');

    const onPopState = (): void => {
      if (selfPopsRef.current > 0) {
        selfPopsRef.current -= 1;
        return;
      }
      if (depthRef.current > 1) {
        depthRef.current -= 1;
        dispatch({ type: 'back' });
        return;
      }
      // At the root the learner pressed Back with nowhere to go. Re-seat our
      // entry instead of letting the browser leave the app (PWA installs have
      // no address bar to come back from).
      window.history.pushState(entryState(1), '');
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((screen: Screen) => {
    dispatch({ type: 'navigate', screen });
    if (!historyAvailable()) return;
    depthRef.current += 1;
    window.history.pushState(entryState(depthRef.current), '');
  }, []);

  const replace = useCallback((screen: Screen) => {
    dispatch({ type: 'replace', screen });
  }, []);

  const back = useCallback(() => {
    dispatch({ type: 'back' });
    if (!historyAvailable() || depthRef.current <= 1) return;
    depthRef.current -= 1;
    selfPopsRef.current += 1;
    window.history.back();
  }, []);

  const reset = useCallback((screen: Screen) => {
    dispatch({ type: 'reset', screen });
    if (!historyAvailable()) return;
    const drop = depthRef.current - 1;
    depthRef.current = 1;
    if (drop <= 0) return;
    selfPopsRef.current += drop;
    window.history.go(-drop);
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({
      screen: currentScreen(state),
      depth: state.stack.length,
      navigate,
      replace,
      back,
      reset,
    }),
    [state, navigate, replace, back, reset],
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
