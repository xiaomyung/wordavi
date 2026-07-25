import { useEffect, useRef } from 'react';
import { initPwaUpdate, notifyScreenChanged } from '@/services/pwaUpdate';
import type { ScreenKind } from './state';

/**
 * Registers the service worker and keeps it told which screen is visible, so an
 * update offer can wait out a drill instead of reloading it away.
 *
 * Production only: dev and test runs stay service-worker-free, which keeps the
 * dev server from being answered by a stale precache.
 */
export function usePwaUpdate(screenKind: ScreenKind): void {
  const screenKindRef = useRef<ScreenKind>(screenKind);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    initPwaUpdate(() => screenKindRef.current);
  }, []);

  useEffect(() => {
    screenKindRef.current = screenKind;
    if (!import.meta.env.PROD) return;
    notifyScreenChanged();
  }, [screenKind]);
}
