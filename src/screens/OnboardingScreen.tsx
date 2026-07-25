/**
 * Onboarding — see design-handoff/wordavi-design-v1/screens/onboarding.html.
 *
 * install → language → practice settings → app settings → ready. The install
 * step only exists when there is something to offer (see `installAffordance`),
 * so the flow is four or five steps and the Dots follow. Steps "practice" and
 * "app" render the REAL settings controls (design README: "same components,
 * same wording"), so anything touched here is already saved and the settings
 * screen shows the same values. Copy stays as the mockup wrote it; the controls
 * start from whatever storage holds, which is why the round stepper shows the
 * app default (20) rather than the mockup's 30.
 *
 * Honesty note: the web cannot launch an installed PWA from a browser tab, so
 * nothing here pretends to. When the app IS the installed app the step never
 * appears; when an install happens mid-flow we say where the icon landed and
 * keep going in the tab the user is already in.
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Chip, Dots, goalRingArc, PriceTag } from '@/components';
import { formatPrice } from '@/engine';
import { log } from '@/services/log';
import type { Settings, UiLang } from '@/storage';
import {
  AccentsSetting,
  BackGlyph,
  GoalSetting,
  type InstallAffordance,
  InstallSteps,
  installAffordance,
  RangeSetting,
  RoundSetting,
  runInstallPrompt,
  type SettingsUpdater,
  SpeechRateSetting,
  ThemeSetting,
  UI_NS,
  useSettingsState,
} from './settingsParts';
import './onboarding-step.css';

export interface OnboardingScreenProps {
  /** `true` = start a round now, `false` = look at the modes first. */
  onDone: (startFirstRound: boolean) => void;
}

type StepKind = 'install' | 'language' | 'practice' | 'app' | 'ready';

/** The steps every device sees; `install` is prepended when it has a job. */
const BASE_STEPS: readonly StepKind[] = ['language', 'practice', 'app', 'ready'];

/** Mirrors `--duration-release`, the fade-out length in onboarding-step.css. */
const STEP_LEAVE_MS = 140;

/**
 * How long the "Установлено!" line stays before the flow moves on: long enough
 * to read, short enough that it feels like the app continuing rather than a
 * dialog waiting on the user.
 */
const INSTALL_ADVANCE_MS = 1200;

/** Microphone permission as this screen tracks it. */
type MicPermission = 'idle' | 'asking' | 'granted' | 'denied';

/** The mic is the app's only permission; ask for nothing we can't use. */
function micSupported(): boolean {
  return (
    typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
  );
}

/** The sample price on the last step (4,75 € — thin space before the sign). */
const SAMPLE_PRICE_EUROS = 4;
const SAMPLE_PRICE_CENTS = 75;

/** Glyph geometry of the app mark, on the favicon's 64-unit canvas. */
const MARK_VIEWBOX = '0 0 64 64';
/** The lowercase w. */
const MARK_W_PATH =
  'M17.49 51.32 17.08 49.8Q16.66 48.34 16.01 45.92Q15.35 43.5 14.55 40.62Q13.75 37.75 12.96 34.84Q12.16 31.93 11.5 29.58Q10.85 27.23 10.36 25.91Q9.25 22.52 6.14 22.45L6 22.17L6.48 18.29H7.66Q8.77 18.29 10.29 18.33Q11.82 18.36 12.85 18.36Q15.14 18.36 17.29 18.22Q19.43 18.09 20.82 17.95L22.2 17.88L22.34 18.22L21.72 22.17Q19.64 22.31 19.02 22.66Q18.39 23 18.39 23.97Q18.39 24.46 18.71 25.98Q19.02 27.5 19.5 29.61Q19.99 31.73 20.54 33.98Q21.09 36.23 21.58 38.17Q22.06 40.1 22.41 41.28L22.69 42.53H23.38Q23.93 41.07 24.63 39.1Q25.32 37.13 25.98 35.05Q26.63 32.97 27.29 31.07Q27.95 29.16 28.4 27.68Q28.85 26.19 29.06 25.49Q28.64 23.9 27.88 23.21Q27.12 22.52 25.18 22.52L24.97 22.17L25.53 18.29H26.7Q27.81 18.29 29.3 18.33Q30.79 18.36 31.9 18.36Q34.18 18.36 36.26 18.26Q38.34 18.16 39.65 18.02L40.97 17.95L41.11 18.29L40.55 22.24Q38.4 22.45 37.82 22.73Q37.23 23 37.23 23.97Q37.23 24.39 37.54 25.91Q37.85 27.43 38.34 29.58Q38.82 31.73 39.37 33.98Q39.93 36.23 40.41 38.17Q40.9 40.1 41.24 41.28L41.52 42.53H42.14Q44.01 37.4 45.36 33.49Q46.71 29.58 47.48 27.09Q48.24 24.59 48.24 23.9Q48.24 23.07 47.79 22.76Q47.34 22.45 46.02 22.45H44.15L43.87 22.03L44.43 18.22H45.61Q46.78 18.29 48.48 18.33Q50.18 18.36 51.7 18.36Q53.08 18.36 54.54 18.33Q55.99 18.29 57.03 18.29H58L57.45 22.45Q55.92 22.66 55.26 23.42Q54.61 24.18 53.71 26.53L45.12 50.28L36.6 51.32Q36.54 50.56 36.09 48.73Q35.64 46.89 34.98 44.36Q34.32 41.84 33.63 39.14Q32.93 36.43 32.24 33.94H31.48L26.15 50.28Z';
/** The acute, floating over the w's right arm. */
const MARK_ACUTE_PATH =
  'M46.42 14.7 45.56 14.47 43.8 12.37Q45.51 10.67 47.16 8.91Q48.81 7.15 50.14 5.71Q51.48 4.26 52.28 3.35L53.07 2.5H53.81L57 6.3L56.94 7.04L55.41 8.12Q53.81 9.2 51.42 10.93Q49.03 12.66 46.42 14.7Z';

/**
 * The app tile: the same drawing as public/favicon.svg and the installed icon,
 * on brand colours that never flip with the theme. The tile box keeps its shelf
 * physics here; only the face is the shared mark, so the glyph paths are the
 * favicon's (copied, not fetched — the tile must render offline and identically
 * whatever the icon file is doing).
 */
function AppTile() {
  return (
    <div
      aria-hidden="true"
      data-app-tile=""
      className="size-22 rounded-card bg-brand-tile text-brand-glyph shadow-[0_4px_0_var(--color-accent-shelf),inset_0_2px_0_var(--color-shelf-glint)]"
    >
      <svg viewBox={MARK_VIEWBOX} className="size-full" fill="currentColor" aria-hidden="true">
        <path d={MARK_W_PATH} />
        <path d={MARK_ACUTE_PATH} />
      </svg>
    </div>
  );
}

/** The goal pill's 26px ring; GoalRing's own sizes (56/72) are far too large here. */
function MiniGoalRing({ goal }: { goal: number }) {
  const arc = goalRingArc(0, goal);
  return (
    <svg width="26" height="26" viewBox="0 0 36 36" aria-hidden="true" className="shrink-0">
      <circle
        cx="18"
        cy="18"
        r="15"
        fill="none"
        className="stroke-surface-well"
        style={{ strokeWidth: 'var(--stroke-ring)' }}
      />
      <circle
        cx="18"
        cy="18"
        r="15"
        fill="none"
        className="stroke-correct"
        strokeDasharray={arc.dasharray}
        strokeLinecap="round"
        transform="rotate(-90 18 18)"
        style={{ strokeWidth: 'var(--stroke-ring)' }}
      />
    </svg>
  );
}

interface StepHeadProps {
  title: string;
  subtitle: string;
}

function StepHead({ title, subtitle }: StepHeadProps) {
  return (
    <div className="mt-4 flex flex-col gap-1.5 text-center">
      <h1 className="font-bold font-display text-title-lg leading-tight">{title}</h1>
      <p className="mx-auto max-w-[19rem] font-semibold text-label text-text-muted leading-normal">
        {subtitle}
      </p>
    </div>
  );
}

interface StepProps {
  settings: Settings;
  update: SettingsUpdater;
  onNext: () => void;
}

interface InstallStepProps {
  /** Never 'hidden' here — the step isn't in the flow at all in that case. */
  affordance: InstallAffordance;
  installed: boolean;
  onInstall: () => void;
  onNext: () => void;
}

/**
 * First step: the install offer. It leads because an installed app is what
 * makes the rest of the app work offline and open from the home screen — but it
 * is never a gate, so the ghost exit is always there.
 */
function InstallStep({ affordance, installed, onInstall, onNext }: InstallStepProps) {
  const { t } = useTranslation();
  const [stepsOpen, setStepsOpen] = useState(false);

  function handleInstall(): void {
    // No programmatic prompt on iOS Safari — the recipe is the affordance.
    if (affordance === 'ios') {
      setStepsOpen(true);
      return;
    }
    onInstall();
  }

  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center gap-4.5 text-center">
        <AppTile />
        <div className="flex flex-col gap-1.5">
          <h1 className="font-bold font-display text-title-lg leading-tight">
            {t('onboarding.install_title')}
          </h1>
          <p
            role={installed ? 'status' : undefined}
            className="mx-auto max-w-[19rem] font-semibold text-label text-text-muted leading-normal"
          >
            {installed ? t('onboarding.install_success') : t('onboarding.install_sub')}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {installed ? null : (
          <Button variant="primary" size="tall" onClick={handleInstall}>
            {t('onboarding.install_cta')}
          </Button>
        )}
        {stepsOpen ? <InstallSteps onClose={() => setStepsOpen(false)} /> : null}
        <Button variant="ghost" onClick={onNext}>
          {t('onboarding.continue_browser')}
        </Button>
      </div>
    </>
  );
}

interface MicCardProps {
  state: MicPermission;
  onAsk: () => void;
}

/**
 * The one permission the app has any use for. Asked here, in context, with the
 * mode it belongs to named — and skippable by simply not tapping it: the drill
 * already has its own "type instead" path when the mic is unavailable.
 */
function MicCard({ state, onAsk }: MicCardProps) {
  const { t } = useTranslation();

  function affordanceFor(): ReactNode {
    if (state === 'granted') {
      return (
        <Chip variant="combo" className="self-start">
          {t('onboarding.mic_done')}
        </Chip>
      );
    }
    if (state === 'denied') {
      return (
        <p className="font-semibold text-caption text-text-muted">{t('onboarding.mic_later')}</p>
      );
    }
    return (
      <Button variant="secondary" disabled={state === 'asking'} onClick={onAsk}>
        {t('onboarding.mic_allow')}
      </Button>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-1 text-left">
        <span className="font-extrabold text-[15px]">{t('onboarding.mic_title')}</span>
        <span className="font-semibold text-caption text-text-muted leading-normal">
          {t('onboarding.mic_sub')}
        </span>
      </div>
      {affordanceFor()}
    </Card>
  );
}

function LanguageStep({ onChoose }: { onChoose: (lang: UiLang) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center gap-4.5 text-center">
        <AppTile />
        <div className="flex flex-col gap-1.5">
          <h1 className="font-bold font-display text-spanish">{t('onboarding.step1_greeting')}</h1>
          <p className="mx-auto max-w-[19rem] font-semibold text-body text-text-muted leading-normal">
            {t('onboarding.step1_subtitle')}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="text-center font-extrabold text-overline text-text-muted tracking-wide">
          {t('onboarding.step1_section')}
        </h2>
        <Button variant="primary" size="tall" onClick={() => onChoose('ru')}>
          {t('settings.language_ru')}
        </Button>
        <Button variant="secondary" size="tall" lang="en" onClick={() => onChoose('en')}>
          {t('settings.language_en')}
        </Button>
        <Button variant="secondary" size="tall" lang="es" onClick={() => onChoose('es')}>
          {t('settings.language_es')}
          <Chip variant="offline">{t('onboarding.step1_spanish_badge')}</Chip>
        </Button>
      </div>
    </>
  );
}

function PracticeStep({ settings, update, onNext }: StepProps) {
  const { t } = useTranslation();
  return (
    <>
      <StepHead title={t('onboarding.step2_title')} subtitle={t('onboarding.step2_subtitle')} />
      <div className="flex flex-1 flex-col justify-center py-4">
        <Card variant="grouped">
          <RangeSetting
            settings={settings}
            update={update}
            hint={t('onboarding.step2_range_sub')}
          />
          <AccentsSetting settings={settings} update={update} />
          <RoundSetting settings={settings} update={update} />
        </Card>
      </div>
      <Button variant="primary" size="tall" onClick={onNext}>
        {t('common.next')}
      </Button>
    </>
  );
}

function AppStep({ settings, update, onNext }: StepProps) {
  const { t } = useTranslation();
  return (
    <>
      <StepHead title={t('onboarding.step3_title')} subtitle={t('onboarding.step3_subtitle')} />
      <div className="flex flex-1 flex-col justify-center py-4">
        <Card variant="grouped">
          <ThemeSetting settings={settings} update={update} />
          <SpeechRateSetting settings={settings} update={update} />
          <GoalSetting settings={settings} update={update} sub={t('onboarding.step3_goal_sub')} />
        </Card>
      </div>
      <Button variant="primary" size="tall" onClick={onNext}>
        {t('common.next')}
      </Button>
    </>
  );
}

interface ReadyStepProps {
  goal: number;
  onFinish: (startFirstRound: boolean) => void;
  /** Omitted when the browser has no getUserMedia — nothing to ask for. */
  mic?: { state: MicPermission; onAsk: () => void };
}

function ReadyStep({ goal, onFinish, mic }: ReadyStepProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-4 text-center">
        <PriceTag>{formatPrice(SAMPLE_PRICE_EUROS, SAMPLE_PRICE_CENTS)}</PriceTag>
        <div className="flex flex-col gap-2">
          <h1 className="font-bold font-display text-title-lg leading-tight">
            {t('onboarding.step4_title')}
          </h1>
          <p className="mx-auto max-w-[19rem] font-semibold text-label text-text-muted leading-normal">
            {t('onboarding.step4_subtitle')}
          </p>
        </div>
        <p className="inline-flex items-center gap-2.5 rounded-pill border border-border bg-surface-raised px-4 py-2 text-left font-bold text-caption">
          <MiniGoalRing goal={goal} />
          {t('onboarding.step4_goal_pill', { n: goal })}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {mic ? <MicCard state={mic.state} onAsk={mic.onAsk} /> : null}
        <Button variant="primary" size="tall" onClick={() => onFinish(true)}>
          {t('onboarding.step4_cta')}
        </Button>
        <Button variant="ghost" onClick={() => onFinish(false)}>
          {t('onboarding.step4_ghost')}
        </Button>
      </div>
    </>
  );
}

export function OnboardingScreen({ onDone }: OnboardingScreenProps) {
  const { t } = useTranslation();
  const { settings, update } = useSettingsState();
  /**
   * The flow is fixed at mount: the install affordance decides whether the
   * install step exists, and step indices (Dots, back navigation) must not
   * renumber themselves underneath the user halfway through.
   */
  const [flow] = useState(() => {
    const affordance = installAffordance();
    const steps: readonly StepKind[] =
      affordance === 'hidden' ? BASE_STEPS : (['install', ...BASE_STEPS] as const);
    log.info(UI_NS, 'onboarding flow built', { affordance, steps: steps.length });
    return { affordance, steps };
  });
  const [step, setStep] = useState(0);
  /** The step being faded out, or null when nothing is leaving. */
  const [leaving, setLeaving] = useState<number | null>(null);
  const [installed, setInstalled] = useState(false);
  const [mic, setMic] = useState<MicPermission>('idle');
  const [micAvailable] = useState(micSupported);
  /** Current step for callbacks that outlive the render they were created in. */
  const stepRef = useRef(0);

  useEffect(() => {
    if (leaving === null) return;
    const timer = window.setTimeout(() => setLeaving(null), STEP_LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  /**
   * Forward and back both cross-fade: the new step enters, the old one fades.
   * Reads the step from a ref so a callback that outlives its render (the
   * install auto-advance) can never navigate from a stale index.
   */
  const goToStep = useCallback(
    (next: number): void => {
      const current = stepRef.current;
      if (next === current || next < 0 || next >= flow.steps.length) return;
      stepRef.current = next;
      setLeaving(current);
      setStep(next);
    },
    [flow.steps.length],
  );

  const goNext = useCallback((): void => {
    goToStep(stepRef.current + 1);
  }, [goToStep]);

  // An install can also complete outside our own prompt (browser menu, or the
  // prompt resolving late), so the event is the second way into the success state.
  useEffect(() => {
    function onInstalled(): void {
      log.info(UI_NS, 'app installed during onboarding', {});
      setInstalled(true);
    }
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  // Installed: show where the icon went, then keep moving. The web cannot open
  // the installed app for the user, so the flow simply continues here.
  useEffect(() => {
    if (!installed) return;
    const timer = window.setTimeout(() => {
      if (flow.steps[stepRef.current] === 'install') goNext();
    }, INSTALL_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [installed, flow.steps, goNext]);

  async function handleInstall(): Promise<void> {
    const outcome = await runInstallPrompt();
    if (outcome === 'accepted') setInstalled(true);
  }

  async function askMicrophone(): Promise<void> {
    setMic('asking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Permission is all we wanted; holding the stream would keep the
      // recording indicator on for the rest of the session.
      for (const track of stream.getTracks()) track.stop();
      setMic('granted');
      log.info(UI_NS, 'microphone granted', {});
    } catch (err) {
      setMic('denied');
      log.warn(UI_NS, 'microphone denied', { error: String(err) });
    }
  }

  function chooseLanguage(uiLang: UiLang): void {
    update({ uiLang }, 'uiLang');
    goNext();
  }

  /**
   * Both exits mark onboarding done: the flow was seen either way, and asking
   * again on the next launch would read as the app forgetting the answer.
   */
  function finish(startFirstRound: boolean): void {
    update({ onboarded: true }, 'onboarded');
    log.info(UI_NS, 'onboarding finished', { startFirstRound });
    onDone(startFirstRound);
  }

  function renderStep(index: number): ReactNode {
    switch (flow.steps[index]) {
      case 'install':
        return (
          <InstallStep
            affordance={flow.affordance}
            installed={installed}
            onInstall={() => {
              void handleInstall();
            }}
            onNext={goNext}
          />
        );
      case 'language':
        return <LanguageStep onChoose={chooseLanguage} />;
      case 'practice':
        return <PracticeStep settings={settings} update={update} onNext={goNext} />;
      case 'app':
        return <AppStep settings={settings} update={update} onNext={goNext} />;
      default:
        return (
          <ReadyStep
            goal={settings.dailyGoal}
            onFinish={finish}
            {...(micAvailable
              ? {
                  mic: {
                    state: mic,
                    onAsk: () => {
                      void askMicrophone();
                    },
                  },
                }
              : {})}
          />
        );
    }
  }

  return (
    <div className="screen">
      <header className="safe-top flex items-center gap-3 px-screen pt-4 pb-1">
        <span className="flex size-(--size-icon-button) shrink-0 items-center justify-center">
          {step > 0 ? (
            <Button variant="icon" onClick={() => goToStep(step - 1)} aria-label={t('common.back')}>
              <BackGlyph />
            </Button>
          ) : null}
        </span>
        <Dots
          count={flow.steps.length}
          activeIndex={step}
          className="flex-1"
          // "N из M" is the app's one progress phrase; reused here so the step
          // indicator carries a name rather than an anonymous progressbar role.
          aria-label={t('drill.counter', { n: step + 1, total: flow.steps.length })}
        />
        <span aria-hidden="true" className="size-(--size-icon-button) shrink-0" />
      </header>

      <div className="screen-content safe-bottom relative flex flex-col px-screen pt-1 pb-6">
        {leaving === null ? null : (
          // Detached copy of the step we just left: out of the accessibility
          // tree and untouchable, so it can only ever be seen, never used.
          <div
            key={`leaving-${leaving}`}
            aria-hidden="true"
            inert
            className="wa-step-leave pointer-events-none absolute inset-0 flex flex-col gap-3 px-screen pt-1 pb-6"
          >
            {renderStep(leaving)}
          </div>
        )}
        {/* Keyed on the step so React remounts and the enter animation replays. */}
        <div key={step} data-step={step} className="wa-step-enter flex flex-1 flex-col gap-3">
          {renderStep(step)}
        </div>
      </div>
    </div>
  );
}
