import { useEffect, useRef } from 'react';
import { initPwaUpdate, notifyScreenChanged } from '@/services/pwaUpdate';
import type { ScreenKind } from './state';

/** The screen an update toast must never interrupt. */
const BUSY_SCREEN: ScreenKind = 'drill';

/**
 * Registers the service worker and keeps it told which screen is visible, so an
 * update offer can wait out a drill instead of reloading it away.
 *
 * Registers in prod AND dev (vite-plugin-pwa devOptions serves a dev SW, and
 * Chrome's install affordance wants a registered worker); only test runs stay
 * service-worker-free.
 */
export function usePwaUpdate(screenKind: ScreenKind): void {
  const screenKindRef = useRef<ScreenKind>(screenKind);

  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    initPwaUpdate({ isBusy: () => screenKindRef.current === BUSY_SCREEN });
  }, []);

  useEffect(() => {
    screenKindRef.current = screenKind;
    if (import.meta.env.MODE === 'test') return;
    notifyScreenChanged();
  }, [screenKind]);
}
