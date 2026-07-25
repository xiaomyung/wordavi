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

/** One entry of `getInstalledRelatedApps()`; only the presence of any entry matters. */
interface RelatedApplication {
  platform?: string;
  url?: string;
  id?: string;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
  interface Navigator {
    standalone?: boolean;
    /** Chrome/Android only; absent everywhere else. */
    getInstalledRelatedApps?: () => Promise<RelatedApplication[]>;
  }
}

export type InstallPromptOutcome = 'accepted' | 'dismissed' | 'unavailable';

let deferredEvent: BeforeInstallPromptEvent | null = null;

type AvailabilityListener = () => void;

const availabilityListeners = new Set<AvailabilityListener>();

function notifyAvailability(): void {
  for (const listener of availabilityListeners) listener();
}

/**
 * Subscribe to anything that changes what an install affordance can offer: a
 * captured `beforeinstallprompt` (a manual recipe can become a real prompt) or
 * an install completing (the offer stops being true). Returns an unsubscribe.
 */
export function onInstallAvailabilityChange(listener: AvailabilityListener): () => void {
  availabilityListeners.add(listener);
  return () => availabilityListeners.delete(listener);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredEvent = event;
    log.info(NS, 'beforeinstallprompt captured', { platforms: event.platforms });
    notifyAvailability();
  });
  window.addEventListener('appinstalled', () => {
    log.info(NS, 'app installed');
    deferredEvent = null;
    notifyAvailability();
  });
}

export function canPromptInstall(): boolean {
  return deferredEvent !== null;
}

/** Shows the captured install prompt. Resolves 'unavailable' if none was captured. */
export async function promptInstall(): Promise<InstallPromptOutcome> {
  if (!deferredEvent) {
    log.warn(NS, 'install prompt requested but unavailable');
    return 'unavailable';
  }

  const event = deferredEvent;
  deferredEvent = null;
  log.info(NS, 'install prompted');
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

/**
 * Whether this app is installed *somewhere on the device*, even though we are
 * being viewed in a browser tab. `isStandalone()` only answers "am I running as
 * the installed app"; a learner who installed us and then opened wordavi.com in
 * a tab must not be invited to install again.
 *
 * Backed by `getInstalledRelatedApps()` (Chrome on Android only) against the
 * manifest's own `related_applications` entry. Everywhere else there is no way
 * to ask, so the honest answer is "not known to be installed" — false.
 */
export async function isInstalled(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const query = navigator.getInstalledRelatedApps;
  if (typeof query !== 'function') return false;
  try {
    const related = await query.call(navigator);
    const installed = Array.isArray(related) && related.length > 0;
    log.info(NS, 'installed related apps queried', { count: related?.length ?? 0, installed });
    return installed;
  } catch (err) {
    log.warn(NS, 'installed related apps query failed', { error: String(err) });
    return false;
  }
}

/** Heuristic for whether to show the manual "Add to Home Screen" sheet instead of a native prompt. */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAppleMobileUa = /iphone|ipad|ipod/i.test(ua);
  const isIpadOs13Plus = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isAppleMobileUa || isIpadOs13Plus;
}
