/**
 * Home screen — visual truth: design-handoff/wordavi-design-v1/screens/home.html
 * (RU light, RU dark, offline frames).
 *
 * Prop-driven: navigation and round-starting are callbacks the app wires up, and
 * the parked round arrives as a prop because the app has to route it too. The
 * screen reads its own dashboard facts (settings, day rows, progress) straight
 * from `@/storage`, because nothing else on the app side owns them and they are
 * pure reads.
 */
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StreakStampDay } from '@/components';
import {
  Button,
  Card,
  ChartGlyph,
  Chip,
  GearGlyph,
  GoalRing,
  MicGlyph,
  ModeRow,
  OfflineGlyph,
  ScrollArea,
  SpeakerGlyph,
  StreakStamps,
} from '@/components';
import type { ModeId } from '@/modes';
import { MIXED_MODE_ID } from '@/modes';
import { isIos } from '@/services/install';
import { isOnline, onOnlineChanged } from '@/services/online';
import { showToast } from '@/services/toast';
import { effectiveDailyGoal, isRoundSerialized, localDayKey, type RoundSize } from '@/session';
import type { SavedRound } from '@/storage';
import { getDays, getProgress, getSettings } from '@/storage';
import { InstallInvite } from './install-offer';
import { buildStreakWindow } from './streak-window';

/* ------------------------------------------------------------------ *
 * Props
 * ------------------------------------------------------------------ */

/** Why a mode row is dashed out. `ok` rows start a round; the rest explain. */
export type HomeModeStatus = 'ok' | 'paused-offline' | 'paused-voice' | 'paused-mic';

export interface HomeModeItem {
  id: string;
  title: string;
  /** Second line of the row — the mode's Spanish example (mode rows, not paused). */
  example: string;
  status: HomeModeStatus;
}

export interface HomeScreenProps {
  modes: readonly HomeModeItem[];
  /**
   * The round left unfinished, if any. A mixed one takes over the big button; a
   * single-mode one only marks its own row.
   */
  parkedRound?: ParkedRound | null;
  /** A row was tapped: play that one mode (resuming it when it is the parked one). */
  onStartMode: (modeId: string) => void;
  /** The big button: play a round mixed from every available mode. */
  onStartMixed: () => void;
  /** The big button again, when the parked round is the mixed one: continue it. */
  onResume: () => void;
  onOpenSettings: () => void;
  onOpenStats: () => void;
}

/* ------------------------------------------------------------------ *
 * Pure helpers
 * ------------------------------------------------------------------ */

const MORNING_HOUR = 5;
const DAY_HOUR = 12;
const EVENING_HOUR = 18;

/** Below this share of the goal the sub-line stays factual, above it cheers. */
const ALMOST_FRACTION = 0.5;

/** The voice/mic explainers are longer than a normal toast — give them time. */
const HINT_TOAST_MS = 8000;

type GreetingKey = 'home.greeting_morning' | 'home.greeting_day' | 'home.greeting_evening';

/** Local wall-clock greeting: 05–12 morning, 12–18 day, otherwise evening. */
export function greetingKeyFor(hour: number): GreetingKey {
  if (hour >= MORNING_HOUR && hour < DAY_HOUR) return 'home.greeting_morning';
  if (hour >= DAY_HOUR && hour < EVENING_HOUR) return 'home.greeting_day';
  return 'home.greeting_evening';
}

/** A resumable round: whose mode it is, and how far it got. */
export interface ParkedRound {
  modeId: string;
  done: number;
  total: RoundSize;
}

/**
 * Read the parked round slot without rehydrating it: the saved payload is the
 * session layer's `RoundSerialized`, so its own type guard is what decides
 * whether the slot is usable. A finished round is never resumable — the learner
 * already ended it.
 */
export function parkedRoundFrom(saved: SavedRound | null): ParkedRound | null {
  if (saved === null) return null;
  const state = saved.state;
  if (!isRoundSerialized(state) || state.finished) return null;
  const total = state.retry ? state.retryItems.length : state.config.size;
  return { modeId: saved.modeId, done: state.records.length, total };
}

/** A round's length as the resume copy prints it: the number, or ∞ when endless. */
function resumeTotalLabel(total: RoundSize, t: TFunction): string {
  return typeof total === 'number' ? String(total) : t('common.endless');
}

/** "N of M" for a parked round, with ∞ standing in for an endless one. */
function progressArgs(parked: ParkedRound, t: TFunction): { done: number; total: string } {
  return { done: parked.done, total: resumeTotalLabel(parked.total, t) };
}

interface HomeData {
  dailyGoal: number;
  doneToday: number;
  streakDays: number;
  stampDays: StreakStampDay[];
  hasHistory: boolean;
}

function readHomeData(now: Date): HomeData {
  const settings = getSettings();
  const days = getDays();
  const progress = getProgress();
  const today = localDayKey(now);
  const dailyGoal = effectiveDailyGoal(settings.dailyGoal);

  return {
    dailyGoal,
    doneToday: days.find((day) => day.date === today)?.correct ?? 0,
    streakDays: progress.streakCurrent,
    stampDays: buildStreakWindow(days, dailyGoal, today),
    hasHistory: progress.totalAnswered > 0 || days.length > 0,
  };
}

interface PausedNotice {
  sub: string;
  chip: string;
  toast: string;
}

/** Sub-line, trailing chip and explainer toast for a paused mode row. */
function pausedNotice(status: HomeModeStatus, t: TFunction): PausedNotice | null {
  switch (status) {
    case 'ok':
      return null;
    case 'paused-offline':
      return {
        sub: t('home.mode_paused_sub'),
        chip: t('home.offline_chip'),
        toast: t('toasts.offline'),
      };
    case 'paused-voice':
      return {
        sub: t('home.mode_paused_voice'),
        chip: t('home.voice_chip'),
        toast: `${t('voice_sheet.title')} · ${isIos() ? t('voice_sheet.ios') : t('voice_sheet.android')}`,
      };
    case 'paused-mic':
      return {
        sub: t('home.mode_paused_mic'),
        chip: t('home.mic_chip'),
        toast: `${t('drill.mic_denied')} · ${t('drill.mic_denied_sub')}`,
      };
  }
}

/**
 * Trailing slot of a mode row: a paused row explains itself, an available one
 * with a parked round offers it back. `null` leaves the chevron in place.
 */
function rowTrailing(
  notice: PausedNotice | null,
  parked: ParkedRound | null,
  t: TFunction,
): ReactNode {
  if (notice !== null) return <Chip variant="offline">{notice.chip}</Chip>;
  if (parked !== null) {
    return <Chip variant="replay">{t('home.row_continue', progressArgs(parked, t))}</Chip>;
  }
  return null;
}

/**
 * Live connectivity for the mode rows. The reading and the events both come from
 * `services/online`, so the screen and everything else that asks (the drill's
 * offline offer, the availability probe) can never disagree about what "offline"
 * means.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(isOnline);

  useEffect(() => onOnlineChanged(setOnline), []);

  return online;
}

/* ------------------------------------------------------------------ *
 * Mode icons (home.html)
 * ------------------------------------------------------------------ */

/**
 * The single glyph in front of a mode row. Keyed by mode id and checked against
 * `ModeId`, so a renamed mode is a type error rather than a silent letter; the
 * composite mode has no row, hence `Partial`.
 */
const MODE_ICONS = {
  words: '42',
  digits: <span className="italic">ab</span>,
  listen: <SpeakerGlyph size={19} />,
  choice: '¿',
  speak: <MicGlyph />,
  grocery: '€',
} satisfies Partial<Record<ModeId, ReactNode>>;

function iconFor(mode: HomeModeItem): ReactNode {
  // A mode with no icon of its own falls back to the first letter of its title.
  return MODE_ICONS[mode.id as keyof typeof MODE_ICONS] ?? mode.title.slice(0, 1);
}

/* ------------------------------------------------------------------ *
 * Screen
 * ------------------------------------------------------------------ */

export function HomeScreen({
  modes,
  parkedRound = null,
  onStartMode,
  onStartMixed,
  onResume,
  onOpenSettings,
  onOpenStats,
}: HomeScreenProps) {
  const { t, i18n } = useTranslation();
  const online = useOnline();

  // One clock reading per mount: greeting, date line and the day window must
  // all describe the same moment.
  const now = useMemo(() => new Date(), []);
  const data = useMemo(() => readHomeData(now), [now]);

  const dateLine = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language || undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(now),
    [i18n.language, now],
  );

  const goalReached = data.doneToday >= data.dailyGoal;
  const goalArgs = { done: data.doneToday, total: data.dailyGoal };
  const goalSub =
    !goalReached && data.doneToday / data.dailyGoal >= ALMOST_FRACTION
      ? t('home.goal_almost', goalArgs)
      : t('home.goal_sub', goalArgs);

  // The big button is always the mixed round: it only turns into "continue"
  // when the parked round *is* that mixed round. A parked single-mode round
  // stays on its own row, so this button never quietly becomes one mode.
  const parkedMixed =
    parkedRound !== null && parkedRound.modeId === MIXED_MODE_ID ? parkedRound : null;

  function pressMode(mode: HomeModeItem, notice: PausedNotice | null): void {
    if (notice === null) {
      onStartMode(mode.id);
      return;
    }
    showToast({ text: notice.toast, duration: HINT_TOAST_MS });
  }

  return (
    <div className="screen">
      <header className="safe-top flex items-center gap-3 px-screen pt-3 pb-1">
        <span className="flex-1 font-bold font-display text-title">
          word<span className="text-accent">aví</span>
        </span>
        {online ? null : (
          <Chip variant="offline" icon={<OfflineGlyph />}>
            {t('home.offline_chip')}
          </Chip>
        )}
        <Button variant="icon" aria-label={t('stats.title')} onClick={onOpenStats}>
          <ChartGlyph />
        </Button>
        <Button variant="icon" aria-label={t('settings.title')} onClick={onOpenSettings}>
          <GearGlyph />
        </Button>
      </header>

      <ScrollArea className="safe-bottom flex flex-col gap-3 px-screen pt-2 pb-6">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-bold font-display text-title-lg">
            {t(greetingKeyFor(now.getHours()))}
          </h1>
          {/* home.html prints the RU date lowercase, exactly as Intl formats it. */}
          <p className="font-semibold text-sub text-text-muted">{dateLine}</p>
        </div>

        <Card>
          <div className="flex items-center gap-3.5">
            <GoalRing value={data.doneToday} max={data.dailyGoal} />
            <div className="flex flex-col gap-0.5">
              <span className="font-extrabold text-sub-strong">{t('home.goal_daily')}</span>
              <span className="numerals font-semibold text-sub text-text-muted">{goalSub}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 border-border border-t border-dashed pt-3">
            <StreakStamps days={data.stampDays} className="flex-1" />
            <span className="numerals shrink-0 whitespace-nowrap font-bold text-caption text-text-muted">
              {t('home.streak_n', { count: data.streakDays })}
            </span>
          </div>
        </Card>

        {/* The big button is a *round*, not a mode: it mixes every available
            mode. Picking one mode is what the rows below are for. */}
        {parkedMixed === null ? (
          <Button className="w-full" onClick={onStartMixed}>
            {data.hasHistory ? t('home.start_round') : t('home.start_cta')}
          </Button>
        ) : (
          <Button className="w-full" onClick={onResume}>
            {t('home.continue_cta', progressArgs(parkedMixed, t))}
          </Button>
        )}

        {/* For anyone who walked past onboarding's install step. Renders itself
            only while there is something to install, so it is silent on a
            device that already has the app (or can't install it at all). */}
        <InstallInvite />

        <p className="mt-0.5 font-extrabold text-overline text-text-muted tracking-[0.4px]">
          {t('home.section_modes')}
        </p>

        <ul className="flex list-none flex-col gap-2.5 p-0">
          {modes.map((mode) => {
            const notice = pausedNotice(mode.status, t);
            // A parked single-mode round is only findable here, so its row says
            // so — quietly, and never over a paused row's own explanation.
            const parkedHere =
              notice === null && parkedRound !== null && parkedRound.modeId === mode.id
                ? parkedRound
                : null;
            return (
              <li key={mode.id}>
                <ModeRow
                  icon={iconFor(mode)}
                  title={mode.title}
                  sub={notice === null ? mode.example : notice.sub}
                  paused={notice !== null}
                  onPress={() => pressMode(mode, notice)}
                  trailing={rowTrailing(notice, parkedHere, t)}
                  {...(notice === null ? {} : { 'aria-disabled': true })}
                />
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </div>
  );
}
