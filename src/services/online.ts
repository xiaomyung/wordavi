/**
 * Connectivity, in one place. `navigator.onLine` is only a hint (it reports the
 * link, not whether anything answers), which is exactly why every caller should
 * read it the same way: absent navigator and `true` both mean "assume online",
 * so a headless/unknown environment never blocks a network-backed feature.
 */

/** True unless the browser is certain there is no network. */
export function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/**
 * Subscribe to connectivity flips; the callback receives the new state.
 * Returns an unsubscribe function (a no-op where there is no window).
 */
export function onOnlineChanged(cb: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const onOnline = (): void => cb(true);
  const onOffline = (): void => cb(false);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
