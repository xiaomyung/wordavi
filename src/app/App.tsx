import { useCallback } from 'react';
import { allModes, MIXED_MODE_ID } from '@/modes';
import { CrashScreen } from '@/screens/CrashScreen';
import { DrillScreen } from '@/screens/DrillScreen';
import { GalleryScreen } from '@/screens/GalleryScreen';
import type { HomeScreenProps } from '@/screens/HomeScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { ReportScreen } from '@/screens/ReportScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { StatsScreen } from '@/screens/StatsScreen';
import { SummaryScreen } from '@/screens/SummaryScreen';
import { log } from '@/services/log';
import { getRound, getSettings, updateSettings } from '@/storage';
import { summaryDayState } from './day-state';
import { ErrorBoundary } from './ErrorBoundary';
import { ScreenTransition } from './ScreenTransition';
import type { Screen } from './state';
import { AppStateProvider, useAppState } from './state';
import { ToastHost } from './ToastHost';
import { useHomeModes } from './useHomeModes';
import { usePwaUpdate } from './usePwaUpdate';

const NS = 'ui';

/** What "start a round" means before anything has ever been played. */
const DEFAULT_MODE_ID = 'words';

/** Hidden component gallery, for visual smokechecks against the design mockups. */
function galleryRequested(): boolean {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).has('gallery');
}

/**
 * Where the app opens. Onboarding gates everything until it has been completed
 * once; `?gallery` bypasses both for design review.
 */
function initialScreen(): Screen {
  if (galleryRequested()) return { kind: 'gallery' };
  return getSettings().onboarded ? { kind: 'home' } : { kind: 'onboarding' };
}

/** The mode a drill should run: whatever was last picked, else the first one. */
function activeModeId(): string {
  return getSettings().lastMode ?? allModes()[0]?.id ?? DEFAULT_MODE_ID;
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
      log.info(NS, 'navigate', { to: next.kind });
      navigate(next);
    },
    [navigate],
  );

  const goBack = useCallback(() => {
    log.info(NS, 'navigate', { to: 'back' });
    back();
  }, [back]);

  const goHome = useCallback(() => {
    log.info(NS, 'navigate', { to: 'home' });
    reset({ kind: 'home' });
  }, [reset]);

  /** Play one mode. The choice is remembered as the learner's last mode. */
  const startMode = useCallback(
    (modeId: string) => {
      updateSettings({ lastMode: modeId });
      log.info(NS, 'navigate', { to: 'drill', modeId });
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
    log.info(NS, 'navigate', { to: 'drill', modeId: MIXED_MODE_ID });
    navigate({ kind: 'drill', modeId: MIXED_MODE_ID });
  }, [navigate]);

  switch (screen.kind) {
    case 'gallery':
      return <GalleryScreen />;

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
          onStartMode={startMode}
          onStartMixed={startMixed}
          // The parked round may belong to a mode other than the last one
          // started; resuming means going back to *its* mode.
          onResume={() => startMode(getRound()?.modeId ?? activeModeId())}
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
          {...(saved !== null && saved.modeId === modeId ? { resume: saved } : {})}
          {...(retryOf !== undefined ? { retryOf } : {})}
          onFinish={(summary) => {
            go({ kind: 'summary', summary, dayState: summaryDayState(summary) });
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

    case 'stats':
      return <StatsScreen onBack={goBack} onStartFirstRound={startMixed} />;

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
