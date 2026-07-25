/**
 * The install offer, wherever it appears: onboarding's first step, the settings
 * row, and the quiet invitation on home.
 *
 * `services/install` answers the browser questions (is there a captured prompt,
 * are we standalone, is this iOS); this module turns those answers into the one
 * decision every caller needs — which affordance to show — and into the two
 * pieces of UI that go with it. Keeping that in one place is what stops the
 * three entry points from disagreeing about whether the app is installable.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '@/components';
import {
  canPromptInstall,
  type InstallPromptOutcome,
  isInstalled,
  isIos,
  isStandalone,
  onInstallAvailabilityChange,
  promptInstall,
} from '@/services/install';
import { log } from '@/services/log';
import { UI_NS } from './log-ns';

/**
 * Which install affordance this device should offer:
 * - `hidden`: the app is already installed — either we ARE the installed app
 *   (standalone) or the device tells us it is installed elsewhere. The only
 *   case where nothing is offered;
 * - `prompt`: a captured `beforeinstallprompt` is ready to fire;
 * - `ios`: no programmatic prompt exists, so we show Safari's two steps;
 * - `manual`: installable, but this browser never fires `beforeinstallprompt`
 *   (Brave disables it by policy, Firefox has no such event) — the offer is
 *   real, so it gets the generic browser-menu recipe rather than silence.
 */
export type InstallAffordance = 'hidden' | 'prompt' | 'ios' | 'manual';

export function installAffordance(): InstallAffordance {
  if (isStandalone()) return 'hidden';
  if (canPromptInstall()) return 'prompt';
  return isIos() ? 'ios' : 'manual';
}

/** Which recipe card an affordance opens; only 'prompt' opens no card at all. */
export function installRecipeFor(affordance: InstallAffordance): InstallRecipe {
  return affordance === 'ios' ? 'ios' : 'manual';
}

/** Fires the captured prompt and logs how it went; the outcome is for callers that react to it. */
export async function runInstallPrompt(): Promise<InstallPromptOutcome> {
  const outcome = await promptInstall();
  log.info(UI_NS, 'install prompt outcome', { outcome });
  return outcome;
}

/**
 * The affordance as live state: re-derived when the browser reports an install
 * and on demand (a prompt the user accepted). Anything that offers to install
 * should use this rather than calling `installAffordance()` in render, so the
 * offer disappears the moment it stops being true.
 */
export interface InstallOffer {
  affordance: InstallAffordance;
  /** Re-derive after something that can change what is offerable. */
  refresh: () => void;
  /** The app is installed now — retract the offer for the rest of the session. */
  markInstalled: () => void;
}

export function useInstallOffer(): InstallOffer {
  const [affordance, setAffordance] = useState(installAffordance);
  /**
   * Installed at some point in this session or already installed on the device.
   * Sticky: `installAffordance()` alone cannot see it, because a browser tab of
   * an installed app is not standalone and may still have no prompt event.
   */
  const [installed, setInstalled] = useState(false);

  const refresh = useCallback(() => setAffordance(installAffordance()), []);
  const markInstalled = useCallback(() => setInstalled(true), []);

  // Fires on a captured `beforeinstallprompt` — a manual recipe can become a
  // real prompt mid-session — and on `appinstalled`.
  useEffect(() => onInstallAvailabilityChange(refresh), [refresh]);

  // The install completing is the one unambiguous signal that we are installed.
  useEffect(() => {
    window.addEventListener('appinstalled', markInstalled);
    return () => window.removeEventListener('appinstalled', markInstalled);
  }, [markInstalled]);

  // Installed but being viewed in a tab: only Chrome/Android can answer this,
  // and only asynchronously, so the offer may retract a tick after mount.
  useEffect(() => {
    let live = true;
    void isInstalled().then((yes) => {
      if (live && yes) setInstalled(true);
    });
    return () => {
      live = false;
    };
  }, []);

  return { affordance: installed ? 'hidden' : affordance, refresh, markInstalled };
}

/**
 * Quiet install invitation: one caption line and a compact button. Used on home
 * for anyone who walked past the install step in onboarding — an invitation, not
 * a nag, so it is a caption rather than a card, it never blocks anything, and it
 * vanishes as soon as the app is installed (or was never installable).
 */
export function InstallInvite() {
  const { t } = useTranslation();
  const { affordance, markInstalled } = useInstallOffer();
  const [stepsOpen, setStepsOpen] = useState(false);

  async function press(): Promise<void> {
    // Anything but a captured prompt is a recipe the learner follows by hand.
    if (affordance !== 'prompt') {
      setStepsOpen((open) => !open);
      return;
    }
    const outcome = await runInstallPrompt();
    // `appinstalled` says the same thing a beat later; this retracts the offer
    // on the tap instead of leaving a stale invitation on screen.
    if (outcome === 'accepted') markInstalled();
  }

  if (affordance === 'hidden') return null;

  return (
    <div className="flex flex-col gap-2" data-install-invite="">
      <div className="flex items-center gap-3">
        <p className="flex-1 font-semibold text-caption text-text-muted leading-normal">
          {t('home.install_invite')}
        </p>
        <Button
          variant="secondary"
          className="h-11 shrink-0 px-4 text-label"
          onClick={() => {
            void press();
          }}
        >
          {t('home.install_cta')}
        </Button>
      </div>
      {stepsOpen ? (
        <InstallSteps recipe={installRecipeFor(affordance)} onClose={() => setStepsOpen(false)} />
      ) : null}
    </div>
  );
}

/** `ios` = Safari's share-sheet recipe, `manual` = the generic browser menu. */
export type InstallRecipe = 'ios' | 'manual';

const RECIPE_KEYS = {
  ios: {
    title: 'install_sheet.title',
    step1: 'install_sheet.step1',
    step2: 'install_sheet.step2',
  },
  manual: {
    title: 'install_sheet.manual_title',
    step1: 'install_sheet.manual_step1',
    step2: 'install_sheet.manual_step2',
  },
} as const;

export interface InstallStepsProps {
  recipe: InstallRecipe;
  onClose: () => void;
}

/** Two-step install recipe, shown inline wherever the install offer lives. */
export function InstallSteps({ recipe, onClose }: InstallStepsProps) {
  const { t } = useTranslation();
  const keys = RECIPE_KEYS[recipe];
  return (
    <Card variant="float" aria-label={t(keys.title)} data-install-recipe={recipe}>
      <span className="font-extrabold text-[15px]">{t(keys.title)}</span>
      <ol className="flex flex-col gap-1.5 font-semibold text-caption text-text-muted">
        <li>1 · {t(keys.step1)}</li>
        <li>2 · {t(keys.step2)}</li>
      </ol>
      <Button variant="ghost" onClick={onClose}>
        {t('common.close')}
      </Button>
    </Card>
  );
}
