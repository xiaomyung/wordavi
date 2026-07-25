import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as install from '@/services/install';
import { log } from '@/services/log';
import { setNavProp } from '../helpers/nav';

/**
 * install.ts attaches its `beforeinstallprompt`/`appinstalled` listeners once,
 * as a module import side effect (matching real usage: imported once at app
 * boot). So this suite imports it once too, and resets state between tests
 * by dispatching `appinstalled` (which clears any captured prompt) rather
 * than re-importing the module - re-importing via vi.resetModules() would
 * leak an extra listener onto the shared `window` per test.
 */

type FakePromptEvent = Event & {
  platforms: string[];
  prompt: ReturnType<typeof vi.fn>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function makePromptEvent(
  opts: { outcome?: 'accepted' | 'dismissed'; prompt?: ReturnType<typeof vi.fn> } = {},
): FakePromptEvent {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as FakePromptEvent;
  event.platforms = ['web'];
  event.prompt = opts.prompt ?? vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: opts.outcome ?? 'accepted', platform: 'web' });
  return event;
}

describe('install', () => {
  beforeEach(() => {
    window.dispatchEvent(new Event('appinstalled'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setNavProp('standalone', undefined);
    setNavProp('userAgent', navigator.userAgent);
    setNavProp('platform', '');
    setNavProp('maxTouchPoints', 0);
  });

  describe('beforeinstallprompt capture', () => {
    it('reports unavailable when no prompt has been captured', async () => {
      const warnSpy = vi.spyOn(log, 'warn');

      expect(install.canPromptInstall()).toBe(false);
      await expect(install.promptInstall()).resolves.toBe('unavailable');
      expect(warnSpy).toHaveBeenCalled();
    });

    it('captures the event, calls preventDefault, and logs the capture', () => {
      const event = makePromptEvent();
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      const infoSpy = vi.spyOn(log, 'info').mockClear();

      window.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
      expect(install.canPromptInstall()).toBe(true);
      expect(infoSpy).toHaveBeenCalledWith('install', 'beforeinstallprompt captured', {
        platforms: ['web'],
      });
    });

    it('promptInstall shows the captured prompt and resolves the user choice', async () => {
      const event = makePromptEvent({ outcome: 'accepted' });
      window.dispatchEvent(event);

      const outcome = await install.promptInstall();

      expect(outcome).toBe('accepted');
      expect(event.prompt).toHaveBeenCalledTimes(1);
    });

    it('reports a dismissed outcome', async () => {
      window.dispatchEvent(makePromptEvent({ outcome: 'dismissed' }));
      await expect(install.promptInstall()).resolves.toBe('dismissed');
    });

    it('is single-use: the captured prompt cannot be replayed', async () => {
      window.dispatchEvent(makePromptEvent());

      await install.promptInstall();
      expect(install.canPromptInstall()).toBe(false);
      await expect(install.promptInstall()).resolves.toBe('unavailable');
    });

    it('returns unavailable and logs an error when prompt() throws', async () => {
      const errorSpy = vi.spyOn(log, 'error');
      window.dispatchEvent(
        makePromptEvent({ prompt: vi.fn().mockRejectedValue(new Error('boom')) }),
      );

      await expect(install.promptInstall()).resolves.toBe('unavailable');
      expect(errorSpy).toHaveBeenCalled();
    });

    it('announces the spent prompt after the learner dismisses it', async () => {
      window.dispatchEvent(makePromptEvent({ outcome: 'dismissed' }));
      const seen: boolean[] = [];
      const unsubscribe = install.onInstallAvailabilityChange(() => {
        seen.push(install.canPromptInstall());
      });

      await install.promptInstall();
      unsubscribe();

      // An affordance re-reading availability here must find nothing left to offer.
      expect(seen).toEqual([false]);
    });

    it('announces the spent prompt after an accepted prompt and after a throw', async () => {
      const notified = vi.fn();
      const unsubscribe = install.onInstallAvailabilityChange(notified);

      window.dispatchEvent(makePromptEvent({ outcome: 'accepted' }));
      notified.mockClear();
      await install.promptInstall();
      expect(notified).toHaveBeenCalledTimes(1);

      window.dispatchEvent(makePromptEvent({ prompt: vi.fn().mockRejectedValue(new Error('no')) }));
      notified.mockClear();
      await install.promptInstall();
      unsubscribe();

      expect(notified).toHaveBeenCalledTimes(1);
    });

    it('stays quiet when there was no prompt to spend', async () => {
      const notified = vi.fn();
      const unsubscribe = install.onInstallAvailabilityChange(notified);

      await install.promptInstall();
      unsubscribe();

      expect(notified).not.toHaveBeenCalled();
    });

    it('clears the captured prompt when appinstalled fires', () => {
      window.dispatchEvent(makePromptEvent());
      expect(install.canPromptInstall()).toBe(true);

      window.dispatchEvent(new Event('appinstalled'));
      expect(install.canPromptInstall()).toBe(false);
    });
  });

  describe('isStandalone', () => {
    it('is true when the display-mode: standalone media query matches', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn((query: string) => ({
          matches: query === '(display-mode: standalone)',
          media: query,
        })),
      );
      expect(install.isStandalone()).toBe(true);
    });

    it('is true when navigator.standalone is set (iOS Safari)', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({ matches: false, media: '' })),
      );
      setNavProp('standalone', true);
      expect(install.isStandalone()).toBe(true);
    });

    it('is false when neither signal indicates standalone', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({ matches: false, media: '' })),
      );
      expect(install.isStandalone()).toBe(false);
    });
  });

  describe('isIos', () => {
    it('is true for an iPhone user agent', () => {
      setNavProp(
        'userAgent',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      );
      expect(install.isIos()).toBe(true);
    });

    it('is false for an Android user agent', () => {
      setNavProp('userAgent', 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36');
      setNavProp('platform', 'Linux armv8l');
      setNavProp('maxTouchPoints', 5);
      expect(install.isIos()).toBe(false);
    });

    it('is true for iPadOS 13+ reporting as MacIntel with touch support', () => {
      setNavProp(
        'userAgent',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15',
      );
      setNavProp('platform', 'MacIntel');
      setNavProp('maxTouchPoints', 5);
      expect(install.isIos()).toBe(true);
    });

    it('is false for a real Mac desktop (MacIntel, no touch)', () => {
      setNavProp(
        'userAgent',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15',
      );
      setNavProp('platform', 'MacIntel');
      setNavProp('maxTouchPoints', 0);
      expect(install.isIos()).toBe(false);
    });
  });
});
