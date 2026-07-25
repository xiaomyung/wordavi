/**
 * Shared settings machinery for SettingsScreen and OnboardingScreen.
 *
 * The design handoff is explicit that onboarding steps 2-3 render the REAL
 * settings controls ("same components, same wording"), so the rows, the
 * persistence path and the live side effects live here once and both screens
 * compose them. Every writer goes through `useSettingsState().update`, which
 * persists immediately, logs, and applies the effect the setting owns
 * (language, theme, sounds) without waiting for a reload. Speech rate adds a
 * per-interaction confirmation rather than a persistent effect: it speaks a
 * sample at the rate just picked (see {@link playSpeechRateSample}).
 *
 * Control geometry mirrors design-handoff/wordavi-design-v1/screens/settings.html:
 * `.srow` = CardRow (label/sub + trailing control), `.scol` = StackedRow
 * (label above a full-width control).
 */
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SegmentedOption } from '@/components';
import { CardRow, RangeSlider, Segmented, Stepper, StopSlider, Toggle } from '@/components';
import { formatNumber } from '@/engine';
import { setLanguage } from '@/i18n';
import { log } from '@/services/log';
import { setEnabled as setSoundsEnabled } from '@/services/sounds';
import { applyTheme } from '@/services/theme';
import { getVoiceStatus, speak } from '@/services/tts';
import type { RoundSizeSetting, Settings, SpeechRate, Theme, UiLang } from '@/storage';
import { getSettings, updateSettings } from '@/storage';
import { UI_NS } from '../log-ns';

/** Questions per round; the last stop is the endless round rendered as ∞. */
const ROUND_SIZES: readonly RoundSizeSetting[] = [10, 20, 30, 'endless'];
const DEFAULT_ROUND_INDEX = 1;

const SPEECH_RATES: readonly SpeechRate[] = ['slow', 'normal', 'fast'];
const DEFAULT_SPEECH_INDEX = 1;

/**
 * Spoken back at the rate just chosen, so "slow / normal / fast" is something
 * the learner hears instead of a word they have to imagine. 475 is the app's
 * signature number (the one the home screen advertises), long enough that a
 * rate difference is audible in it.
 */
const SPEECH_RATE_SAMPLE = 'cuatrocientos setenta y cinco';

const GOAL_MIN = 5;
const GOAL_MAX = 50;
const GOAL_STEP = 5;

export type SettingsPatch = Partial<Omit<Settings, 'updatedAt'>>;

/** Persists a patch, logs it, and applies the setting's live effect. */
export type SettingsUpdater = (patch: SettingsPatch, key: string) => Settings;

export interface SettingsState {
  settings: Settings;
  update: SettingsUpdater;
  /** Re-reads storage and re-applies every live effect (used after an import). */
  reload: () => Settings;
}

/**
 * Settings that change something outside storage do it here, so a value
 * written by onboarding behaves exactly like the same value written by the
 * settings screen.
 */
function applyLiveEffects(patch: SettingsPatch): void {
  if (patch.uiLang !== undefined) setLanguage(patch.uiLang);
  if (patch.theme !== undefined) applyTheme(patch.theme);
  if (patch.soundsEnabled !== undefined) setSoundsEnabled(patch.soundsEnabled);
}

export function useSettingsState(): SettingsState {
  const [settings, setSettings] = useState<Settings>(() => getSettings());

  const update = useCallback<SettingsUpdater>((patch, key) => {
    const next = updateSettings(patch);
    setSettings(next);
    applyLiveEffects(patch);
    log.info(UI_NS, 'setting changed', { key });
    return next;
  }, []);

  const reload = useCallback(() => {
    const next = getSettings();
    setSettings(next);
    applyLiveEffects(next);
    return next;
  }, []);

  return { settings, update, reload };
}

export interface SettingRowProps {
  settings: Settings;
  update: SettingsUpdater;
}

interface StackedRowProps {
  label: string;
  /** Right-aligned readout on the label line (current value). */
  value?: ReactNode;
  /** Caption under the label. */
  sub?: ReactNode;
  /** Caption under the control. */
  hint?: ReactNode;
  children: ReactNode;
}

/** `.scol`: label (+ readout) above a full-width control. */
export function StackedRow({ label, value, sub, hint, children }: StackedRowProps) {
  return (
    <div className="flex flex-col gap-2.5 px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-extrabold text-[15px]">{label}</span>
        {value}
      </div>
      {sub ? (
        <span className="-mt-1.5 font-semibold text-caption text-text-muted">{sub}</span>
      ) : null}
      {children}
      {hint ? <span className="font-semibold text-caption text-text-muted">{hint}</span> : null}
    </div>
  );
}

export interface RangeSettingProps extends SettingRowProps {
  hint?: string;
}

export function RangeSetting({ settings, update, hint }: RangeSettingProps) {
  const { t } = useTranslation();
  const label = t('settings.range_label');
  /**
   * The value being dragged, or null when the slider is at rest. A full drag
   * crosses ~100 stops; storage only hears the one the user let go of, so the
   * readout stays live while the writing (and its log line) happens once.
   */
  const [draft, setDraft] = useState<[number, number] | null>(null);
  const value: [number, number] = draft ?? [settings.rangeMin, settings.rangeMax];

  const tickLabels = [
    t('settings.range_tick_0'),
    t('settings.range_tick_10'),
    t('settings.range_tick_100'),
    t('settings.range_tick_1k'),
    t('settings.range_tick_10k'),
    t('settings.range_tick_100k'),
    t('settings.range_tick_1m'),
  ];

  const readout = `${formatNumber(value[0])} — ${formatNumber(value[1])}`;

  return (
    <StackedRow
      label={label}
      value={<span className="numerals font-extrabold text-accent text-label">{readout}</span>}
      {...(hint !== undefined ? { hint } : {})}
    >
      <RangeSlider
        value={value}
        onChange={(next) => setDraft(next)}
        onChangeCommitted={([min, max]) => {
          setDraft(null);
          update({ rangeMin: min, rangeMax: max }, 'range');
        }}
        tickLabels={tickLabels}
        formatValue={formatNumber}
        minThumbLabel={`${label} — min`}
        maxThumbLabel={`${label} — max`}
      />
    </StackedRow>
  );
}

export function AccentsSetting({ settings, update }: SettingRowProps) {
  const { t } = useTranslation();
  const label = t('settings.accents_label');
  return (
    <CardRow
      label={label}
      sub={<span lang="es">{t('settings.accents_sub')}</span>}
      trailing={
        <Toggle
          checked={settings.acceptNoAccents}
          onChange={(checked) => update({ acceptNoAccents: checked }, 'acceptNoAccents')}
          aria-label={label}
        />
      }
    />
  );
}

/** Cycles 10 → 20 → 30 → ∞ → 10; both keys always step, never dead-end. */
export function RoundSetting({ settings, update }: SettingRowProps) {
  const { t } = useTranslation();
  const label = t('settings.questions_per_round_label');
  const found = ROUND_SIZES.indexOf(settings.roundSize);
  const index = found < 0 ? DEFAULT_ROUND_INDEX : found;

  function cycle(delta: number): void {
    const count = ROUND_SIZES.length;
    const next = ROUND_SIZES[(index + delta + count) % count];
    if (next !== undefined) update({ roundSize: next }, 'roundSize');
  }

  return (
    <CardRow
      label={label}
      trailing={
        <Stepper aria-label={label} onDecrement={() => cycle(-1)} onIncrement={() => cycle(1)}>
          {settings.roundSize === 'endless' ? t('common.endless') : settings.roundSize}
        </Stepper>
      }
    />
  );
}

export function LanguageSetting({ settings, update }: SettingRowProps) {
  const { t } = useTranslation();
  const label = t('settings.ui_language_label');
  const options: readonly SegmentedOption<UiLang>[] = [
    { value: 'ru', label: t('settings.language_ru') },
    { value: 'en', label: t('settings.language_en'), lang: 'en' },
    { value: 'es', label: t('settings.language_es'), lang: 'es' },
  ];

  return (
    <StackedRow label={label} sub={t('settings.ui_language_sub')}>
      <Segmented
        options={options}
        value={settings.uiLang}
        onChange={(uiLang) => update({ uiLang }, 'uiLang')}
        aria-label={label}
      />
    </StackedRow>
  );
}

export function ThemeSetting({ settings, update }: SettingRowProps) {
  const { t } = useTranslation();
  const label = t('settings.theme_label');
  const options: readonly SegmentedOption<Theme>[] = [
    { value: 'auto', label: t('settings.theme_auto') },
    { value: 'light', label: t('settings.theme_light') },
    { value: 'dark', label: t('settings.theme_dark') },
  ];

  return (
    <StackedRow label={label}>
      <Segmented
        options={options}
        value={settings.theme}
        onChange={(theme) => update({ theme }, 'theme')}
        aria-label={label}
      />
    </StackedRow>
  );
}

/**
 * Plays the sample at `rate`. Fired once per interaction (the slider's commit,
 * not every stop the thumb snaps through), and `speak` cancels whatever is
 * in flight first — so a learner sliding back and forth hears the newest
 * sample cut the previous one instead of a chorus. Silent on devices with no
 * Spanish voice, and a sample that fails anyway is cosmetic: it goes to the
 * log, never to a toast.
 */
function playSpeechRateSample(rate: SpeechRate): void {
  if (getVoiceStatus() === 'none') return;
  void speak(SPEECH_RATE_SAMPLE, { rate }).catch((error: unknown) => {
    log.debug(UI_NS, 'speech rate sample failed', { rate, error });
  });
}

export function SpeechRateSetting({ settings, update }: SettingRowProps) {
  const { t } = useTranslation();
  const label = t('settings.speech_speed_label');
  const stops = [t('settings.speed_slow'), t('settings.speed_normal'), t('settings.speed_fast')];
  const found = SPEECH_RATES.indexOf(settings.speechRate);
  /** Same rule as the range: the thumb moves live, storage hears it once. */
  const [draft, setDraft] = useState<number | null>(null);
  const index = draft ?? (found < 0 ? DEFAULT_SPEECH_INDEX : found);

  return (
    <StackedRow
      label={label}
      value={<span className="font-bold text-[13px] text-text-muted">{stops[index]}</span>}
    >
      <StopSlider
        stops={stops}
        index={index}
        onChange={(next) => setDraft(next)}
        onChangeCommitted={(next) => {
          setDraft(null);
          const rate = SPEECH_RATES[next];
          if (!rate) return;
          update({ speechRate: rate }, 'speechRate');
          playSpeechRateSample(rate);
        }}
        ariaLabel={label}
      />
    </StackedRow>
  );
}

export interface GoalSettingProps extends SettingRowProps {
  /** Onboarding softens the caption ("· можно меньше"); settings uses the plain one. */
  sub?: string;
}

export function GoalSetting({ settings, update, sub }: GoalSettingProps) {
  const { t } = useTranslation();
  const label = t('settings.daily_goal_label');

  function step(delta: number): void {
    const next = Math.min(GOAL_MAX, Math.max(GOAL_MIN, settings.dailyGoal + delta * GOAL_STEP));
    if (next !== settings.dailyGoal) update({ dailyGoal: next }, 'dailyGoal');
  }

  return (
    <CardRow
      label={label}
      sub={sub ?? t('settings.daily_goal_sub')}
      trailing={
        <Stepper
          aria-label={label}
          canDecrement={settings.dailyGoal > GOAL_MIN}
          canIncrement={settings.dailyGoal < GOAL_MAX}
          onDecrement={() => step(-1)}
          onIncrement={() => step(1)}
        >
          {settings.dailyGoal}
        </Stepper>
      }
    />
  );
}

export function SoundsSetting({ settings, update }: SettingRowProps) {
  const { t } = useTranslation();
  const label = t('settings.sounds_label');
  return (
    <CardRow
      label={label}
      sub={t('settings.sounds_sub')}
      trailing={
        <Toggle
          checked={settings.soundsEnabled}
          onChange={(checked) => update({ soundsEnabled: checked }, 'soundsEnabled')}
          aria-label={label}
        />
      }
    />
  );
}
