/**
 * PWA install-prompt capture. `beforeinstallprompt` fires early and only
 * once per page load on supporting browsers, so the listener attaches as
 * soon as this module is imported (from app bootstrap) rather than waiting
 * for a screen to mount.
 */
import { log } from '@/services/log';

const NS = 'install';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
  interface Navigator {
    standalone?: boolean;
  }
}

export type InstallPromptOutcome = 'accepted' | 'dismissed' | 'unavailable';

let deferredEvent: BeforeInstallPromptEvent | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredEvent = event;
    log.info(NS, 'beforeinstallprompt captured', { platforms: event.platforms });
  });
  window.addEventListener('appinstalled', () => {
    log.info(NS, 'app installed', {});
    deferredEvent = null;
  });
}

export function canPromptInstall(): boolean {
  return deferredEvent !== null;
}

/** Shows the captured install prompt. Resolves 'unavailable' if none was captured. */
export async function promptInstall(): Promise<InstallPromptOutcome> {
  if (!deferredEvent) {
    log.warn(NS, 'install prompt requested but unavailable', {});
    return 'unavailable';
  }

  const event = deferredEvent;
  deferredEvent = null;
  log.info(NS, 'install prompted', {});
  try {
    await event.prompt();
    const choice = await event.userChoice;
    log.info(NS, 'install prompt resolved', { outcome: choice.outcome });
    return choice.outcome;
  } catch (err) {
    log.error(NS, 'install prompt failed', { error: String(err) });
    return 'unavailable';
  }
}

export function isStandalone(): boolean {
  const displayModeStandalone =
    typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = typeof navigator !== 'undefined' && navigator.standalone === true;
  return displayModeStandalone || iosStandalone;
}

/** Heuristic for whether to show the manual "Add to Home Screen" sheet instead of a native prompt. */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAppleMobileUa = /iphone|ipad|ipod/i.test(ua);
  const isIpadOs13Plus = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isAppleMobileUa || isIpadOs13Plus;
}
