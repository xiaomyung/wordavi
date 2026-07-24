/**
 * Onboarding — see design-handoff/wordavi-design-v1/screens/onboarding.html.
 *
 * Four steps: language → practice settings → app settings → ready. Steps 2 and
 * 3 render the REAL settings controls (design README: "same components, same
 * wording"), so anything touched here is already saved and the settings screen
 * shows the same values. Copy stays as the mockup wrote it; the controls start
 * from whatever storage holds, which is why the round stepper shows the app
 * default (20) rather than the mockup's 30.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Chip, Dots, goalRingArc, PriceTag } from '@/components';
import { formatPrice } from '@/engine';
import { log } from '@/services/log';
import type { Settings, UiLang } from '@/storage';
import {
  AccentsSetting,
  BackGlyph,
  GoalSetting,
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

export interface OnboardingScreenProps {
  /** `true` = start a round now, `false` = look at the modes first. */
  onDone: (startFirstRound: boolean) => void;
}

const STEP_COUNT = 4;

/** The sample price on the last step (4,75 € — thin space before the sign). */
const SAMPLE_PRICE_EUROS = 4;
const SAMPLE_PRICE_CENTS = 75;

/** The app icon, drawn from tokens rather than shipped as an image. */
function AppTile() {
  return (
    <div
      aria-hidden="true"
      className="relative flex size-22 items-center justify-center rounded-card bg-accent font-bold font-display text-[3.25rem] text-on-accent shadow-[0_4px_0_var(--color-accent-shelf),inset_0_2px_0_var(--color-shelf-glint)]"
    >
      <span className="absolute top-3 left-3 size-2.5 rounded-full bg-surface" />w
      <span className="absolute top-5 right-5 text-[1.5rem] text-on-accent/70 leading-none">´</span>
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
}

function ReadyStep({ goal, onFinish }: ReadyStepProps) {
  const { t } = useTranslation();
  const [installStepsOpen, setInstallStepsOpen] = useState(false);
  const affordance = installAffordance();

  function handleInstall(): void {
    if (affordance === 'prompt') {
      void runInstallPrompt();
      return;
    }
    setInstallStepsOpen(true);
  }

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
          {t('onboarding.step4_goal_pill')}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {affordance === 'hidden' ? null : (
          <Button variant="secondary" size="tall" onClick={handleInstall}>
            {t('onboarding.install_cta')}
          </Button>
        )}
        {installStepsOpen ? <InstallSteps onClose={() => setInstallStepsOpen(false)} /> : null}
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
  const [step, setStep] = useState(0);

  function chooseLanguage(uiLang: UiLang): void {
    update({ uiLang }, 'uiLang');
    setStep(1);
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

  return (
    <div className="screen">
      <header className="safe-top flex items-center gap-3 px-screen pt-4 pb-1">
        <span className="flex size-(--size-icon-button) shrink-0 items-center justify-center">
          {step > 0 ? (
            <Button variant="icon" onClick={() => setStep(step - 1)} aria-label={t('common.back')}>
              <BackGlyph />
            </Button>
          ) : null}
        </span>
        <Dots count={STEP_COUNT} activeIndex={step} className="flex-1" />
        <span aria-hidden="true" className="size-(--size-icon-button) shrink-0" />
      </header>

      <div className="screen-content safe-bottom flex flex-col gap-3 px-screen pt-1 pb-6">
        {step === 0 ? <LanguageStep onChoose={chooseLanguage} /> : null}
        {step === 1 ? (
          <PracticeStep settings={settings} update={update} onNext={() => setStep(2)} />
        ) : null}
        {step === 2 ? (
          <AppStep settings={settings} update={update} onNext={() => setStep(3)} />
        ) : null}
        {step === 3 ? <ReadyStep goal={settings.dailyGoal} onFinish={finish} /> : null}
      </div>
    </div>
  );
}
