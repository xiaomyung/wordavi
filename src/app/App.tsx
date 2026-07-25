import { lazy, Suspense, useCallback } from 'react';
import { allModes, MIXED_MODE_ID } from '@/modes';
import { CrashScreen } from '@/screens/CrashScreen';
import { DrillScreen } from '@/screens/DrillScreen';
import type { HomeScreenProps, ParkedRound } from '@/screens/HomeScreen';
import { HomeScreen, parkedRoundFrom } from '@/screens/HomeScreen';
import { UI_NS } from '@/screens/log-ns';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { ReportScreen } from '@/screens/ReportScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { StatsScreen } from '@/screens/StatsScreen';
import { SummaryScreen } from '@/screens/SummaryScreen';
import { log } from '@/services/log';
import { getRound, getSettings, updateSettings } from '@/storage';
import { currentAvailableModeIds } from './availability';
import { summaryDayState } from './day-state';
import { ErrorBoundary } from './ErrorBoundary';
import { galleryRequested } from './gallery';
import { ScreenTransition } from './ScreenTransition';
import type { Screen } from './state';
import { AppStateProvider, useAppState } from './state';
import { settledStreak } from './streak';
import { ToastHost } from './ToastHost';
import { useGestureWarmup } from './useGestureWarmup';
import { useHomeModes } from './useHomeModes';
import { usePwaUpdate } from './usePwaUpdate';

/**
 * The gallery is a design-review surface, not part of the app. `__GALLERY__` is
 * a compile-time constant (vite.config.ts): the builds that leave the gallery
 * out lose this import with the branch, chunk and all, and the ones that keep it
 * still fetch every specimen of every component only when `?gallery` asks.
 */
const GalleryScreen = __GALLERY__
  ? lazy(async () => ({
      default: (await import('@/screens/GalleryScreen')).GalleryScreen,
    }))
  : null;

/** What "start a round" means before anything has ever been played. */
const DEFAULT_MODE_ID = 'words';

/**
 * Where the app opens. Onboarding gates everything until it has been completed
 * once; `?gallery` bypasses both for design review, where there is a gallery.
 */
function initialScreen(): Screen {
  if (typeof location !== 'undefined' && galleryRequested(location.search, __GALLERY__)) {
    return { kind: 'gallery' };
  }
  return getSettings().onboarded ? { kind: 'home' } : { kind: 'onboarding' };
}

/** The mode a drill should run: whatever was last picked, else the first one. */
function activeModeId(): string {
  return getSettings().lastMode ?? allModes()[0]?.id ?? DEFAULT_MODE_ID;
}

/** The round left mid-way, as home needs to see it (mode included). */
function parkedRound(): ParkedRound | null {
  return parkedRoundFrom(getRound());
}

/**
 * Home owns the only live capability subscriptions in the app, so they mount
 * and unmount with the screen that needs them rather than with the router.
 */
function HomeRoute(props: Omit<HomeScreenProps, 'modes'>) {
  const modes = useHomeModes();
  return <HomeScreen modes={modes} {...props} />;
}

function ScreenRouter() {
  const { screen, navigate, back, reset } = useAppState();

  const go = useCallback(
    (next: Screen) => {
      log.info(UI_NS, 'navigate', { to: next.kind });
      navigate(next);
    },
    [navigate],
  );

  const goBack = useCallback(() => {
    log.info(UI_NS, 'navigate', { to: 'back' });
    back();
  }, [back]);

  const goHome = useCallback(() => {
    log.info(UI_NS, 'navigate', { to: 'home' });
    reset({ kind: 'home' });
  }, [reset]);

  /** Play one mode. The choice is remembered as the learner's last mode. */
  const startMode = useCallback(
    (modeId: string) => {
      updateSettings({ lastMode: modeId });
      log.info(UI_NS, 'navigate', { to: 'drill', modeId });
      navigate({ kind: 'drill', modeId });
    },
    [navigate],
  );

  /**
   * The big start button: a round drawn from every available mode. It is not a
   * mode choice, so it deliberately leaves `lastMode` alone — that stays the
   * last row the learner picked.
   */
  const startMixed = useCallback(() => {
    log.info(UI_NS, 'navigate', { to: 'drill', modeId: MIXED_MODE_ID });
    navigate({ kind: 'drill', modeId: MIXED_MODE_ID });
  }, [navigate]);

  switch (screen.kind) {
    // Unreachable without a gallery to reach: nothing navigates here, and
    // `?gallery` is inert in a build that carries none.
    case 'gallery':
      if (GalleryScreen === null) return null;
      // No fallback: the chunk is local and the gallery is never on the
      // learner's path, so a flash of nothing beats a flash of skeleton.
      return (
        <Suspense fallback={null}>
          <GalleryScreen />
        </Suspense>
      );

    case 'onboarding':
      return (
        <OnboardingScreen
          onDone={(startFirstRound) => {
            // Home is the root either way — a learner who backs out of that
            // first round should land there, not back in onboarding.
            goHome();
            // A first round that samples every mode is the friendliest
            // introduction — the same round the home button plays.
            if (startFirstRound) startMixed();
          }}
        />
      );

    case 'home':
      return (
        <HomeRoute
          parkedRound={parkedRound()}
          streakDays={settledStreak().current}
          // A row starts its own mode, and the drill picks the parked round up
          // when that mode matches — so a parked single-mode round continues
          // from its row.
          onStartMode={startMode}
          onStartMixed={startMixed}
          // Continuing the parked *mixed* round is the same navigation as
          // starting one: the drill resumes it because the mode matches, and
          // `lastMode` stays the learner's own row choice.
          onResume={startMixed}
          onOpenSettings={() => go({ kind: 'settings' })}
          onOpenStats={() => go({ kind: 'stats' })}
        />
      );

    case 'drill': {
      const retryOf = screen.retryOf;
      // A retry keeps its round's mode; otherwise the navigation carries it,
      // and only a stale entry falls back to the last mode played.
      const modeId = retryOf?.modeId ?? screen.modeId ?? activeModeId();
      // A retry replaces the round rather than continuing one, so the parked
      // slot is not even consulted.
      const saved = retryOf === undefined ? getRound() : null;
      return (
        <DrillScreen
          modeId={modeId}
          // Only the app layer may ask the services what this browser can serve,
          // so a mixed round is handed the list rather than sampling it itself.
          // Read here, at the round's start: a resumed or retried mixed round is
          // filtered by the capabilities of *this* moment.
          availableModeIds={currentAvailableModeIds()}
          {...(saved !== null && saved.modeId === modeId ? { resume: saved } : {})}
          {...(retryOf !== undefined ? { retryOf } : {})}
          onFinish={(summary, stampEarned) => {
            go({ kind: 'summary', summary, dayState: summaryDayState(stampEarned) });
          }}
          onExit={goBack}
        />
      );
    }

    case 'summary':
      return (
        <SummaryScreen
          summary={screen.summary}
          dayState={screen.dayState}
          onRetryMissed={() => go({ kind: 'drill', retryOf: screen.summary })}
          onBackHome={goHome}
        />
      );

    case 'settings':
      return <SettingsScreen onBack={goBack} onReport={() => go({ kind: 'report' })} />;

    case 'stats': {
      const streak = settledStreak();
      return (
        <StatsScreen
          streakCurrent={streak.current}
          streakBest={streak.best}
          onBack={goBack}
          onStartFirstRound={startMixed}
        />
      );
    }

    case 'report':
      return <ReportScreen onClose={goBack} />;

    // Reachable only by navigation; a *thrown* crash is caught by the error
    // boundary above, which renders the same screen outside the router.
    case 'crash':
      return (
        <CrashScreen
          onRestart={() => window.location.reload()}
          onReport={() => go({ kind: 'report' })}
        />
      );
  }
}

function AppRoot() {
  const { screen } = useAppState();
  usePwaUpdate(screen.kind);
  useGestureWarmup();
  return (
    <ScreenTransition screenKey={screen.kind}>
      <ScreenRouter />
    </ScreenTransition>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AppStateProvider initial={initialScreen()}>
        <AppRoot />
        <ToastHost />
      </AppStateProvider>
    </ErrorBoundary>
  );
}
