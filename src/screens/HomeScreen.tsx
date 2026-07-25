/**
 * Home screen — visual truth: design-handoff/wordavi-design-v1/screens/home.html
 * (RU light, RU dark, offline frames).
 *
 * Prop-driven: navigation and round-starting are callbacks the app wires up.
 * The screen reads its own dashboard facts (settings, day rows, progress, the
 * parked round) straight from `@/storage`, because nothing else on the app side
 * owns them and they are pure reads.
 */
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StreakStampDay } from '@/components';
import { Button, Card, Chip, GoalRing, ModeRow, StreakStamps } from '@/components';
import { showToast } from '@/services/toast';
import { isRoundSerialized, type RoundSize } from '@/session';
import type { SavedRound } from '@/storage';
import { getDays, getProgress, getRound, getSettings } from '@/storage';
import { buildStreakWindow, localDayKey } from './streak-window';

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
  /** A row was tapped: play that one mode. */
  onStartMode: (modeId: string) => void;
  /** The big button: play a round mixed from every available mode. */
  onStartMixed: () => void;
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

export interface SavedRoundProgress {
  done: number;
  total: RoundSize;
}

/**
 * Read "N of M" out of the parked round slot without rehydrating it: the saved
 * payload is the session layer's `RoundSerialized`, so its own type guard is
 * what decides whether the slot is usable. A finished round never offers a
 * resume — the learner already ended it.
 */
export function savedRoundProgress(saved: SavedRound | null): SavedRoundProgress | null {
  if (saved === null) return null;
  const state = saved.state;
  if (!isRoundSerialized(state) || state.finished) return null;
  const total = state.retry ? state.retryItems.length : state.config.size;
  return { done: state.records.length, total };
}

interface HomeData {
  dailyGoal: number;
  doneToday: number;
  streakDays: number;
  stampDays: StreakStampDay[];
  resume: SavedRoundProgress | null;
  hasHistory: boolean;
}

function readHomeData(now: Date): HomeData {
  const settings = getSettings();
  const days = getDays();
  const progress = getProgress();
  const today = localDayKey(now);
  const dailyGoal = Math.max(1, settings.dailyGoal);

  return {
    dailyGoal,
    doneToday: days.find((day) => day.date === today)?.correct ?? 0,
    streakDays: progress.streakCurrent,
    stampDays: buildStreakWindow(days, dailyGoal, today),
    resume: savedRoundProgress(getRound()),
    hasHistory: progress.totalAnswered > 0 || days.length > 0,
  };
}

interface PausedNotice {
  sub: string;
  chip: string;
  toast: string;
}

function isIos(): boolean {
  return typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
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

/** Live `navigator.onLine`, kept fresh by the online/offline window events. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine !== false,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

/* ------------------------------------------------------------------ *
 * Glyphs (home.html inline SVGs)
 * ------------------------------------------------------------------ */

function ChartGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M5 20V12M12 20V4M19 20v-6" />
    </svg>
  );
}

function GearGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 3h-4l-.5 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 005 12a7 7 0 00.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2L10 21h4l.5-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.06-.4.1-.8.1-1.2z" />
    </svg>
  );
}

function OfflineGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M2 9a15 15 0 0110.6-4.4M22 9a15 15 0 00-4.8-3.2M6 13a9.5 9.5 0 015.4-2.7M18 13a9.5 9.5 0 00-2-1.6M10 17a4 4 0 014 0M12 21h.01M4 4l16 16" />
    </svg>
  );
}

function SpeakerGlyph() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4z" fill="currentColor" />
      <path
        d="M15.5 8.5a5 5 0 010 7M17.8 6.2a8.2 8.2 0 010 11.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MicGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
      <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" />
    </svg>
  );
}

const MODE_ICONS: Record<string, ReactNode> = {
  words: '42',
  digits: <span className="italic">ab</span>,
  listen: <SpeakerGlyph />,
  choice: '¿',
  speak: <MicGlyph />,
  grocery: '€',
};

function iconFor(mode: HomeModeItem): ReactNode {
  return MODE_ICONS[mode.id] ?? mode.title.slice(0, 1);
}

/* ------------------------------------------------------------------ *
 * Screen
 * ------------------------------------------------------------------ */

export function HomeScreen({
  modes,
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

  const resumeTotal =
    data.resume === null
      ? ''
      : typeof data.resume.total === 'number'
        ? String(data.resume.total)
        : t('common.endless');

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

      <div className="screen-content safe-bottom flex flex-col gap-3 px-screen pt-2 pb-6">
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
        {data.resume === null ? (
          <Button className="w-full" onClick={onStartMixed}>
            {data.hasHistory ? t('home.start_round') : t('home.start_cta')}
          </Button>
        ) : (
          <Button className="w-full" onClick={onResume}>
            {t('home.continue_cta', { done: data.resume.done, total: resumeTotal })}
          </Button>
        )}

        <p className="mt-0.5 font-extrabold text-overline text-text-muted tracking-[0.4px]">
          {t('home.section_modes')}
        </p>

        <ul className="flex list-none flex-col gap-2.5 p-0">
          {modes.map((mode) => {
            const notice = pausedNotice(mode.status, t);
            return (
              <li key={mode.id}>
                <ModeRow
                  icon={iconFor(mode)}
                  title={mode.title}
                  sub={notice === null ? mode.example : notice.sub}
                  paused={notice !== null}
                  onPress={() => pressMode(mode, notice)}
                  {...(notice === null
                    ? {}
                    : {
                        'aria-disabled': true,
                        trailing: <Chip variant="offline">{notice.chip}</Chip>,
                      })}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
