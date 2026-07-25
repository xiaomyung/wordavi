/**
 * Stats screen — visual truth:
 * design-handoff/wordavi-design-v1/screens/stats.html (RU dark + day-zero light).
 *
 * Near self-contained read: the tiles, the skill bars and the day window are all
 * derived from storage via `computeStats`. Only the streak numbers arrive as
 * props, because a stored run has to be read against today's date before it can
 * be printed and the app owns that reading for every screen that shows it. Streak
 * stamps never guilt — missed days are plain empty circles.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { StreakStampDay } from '@/components';
import { BackGlyph, Button, Card, Chip, ScrollArea, SkillBar, StreakStamps } from '@/components';
import { formatNumber } from '@/engine';
import type { DisplayGroup, SessionStats } from '@/session';
import {
  computeStats,
  DISPLAY_GROUP_ORDER,
  deserializeSrs,
  effectiveDailyGoal,
  isGoalMet,
  localDayKey,
  localMonthKey,
} from '@/session';
import { getDays, getProgress, getSettings, getSrs } from '@/storage';
import { buildStreakWindow } from './streak-window';

/* ------------------------------------------------------------------ *
 * Props
 * ------------------------------------------------------------------ */

export interface StatsScreenProps {
  /** Days in the run as of today — the calendar can end a run on its own. */
  streakCurrent: number;
  /** The longest run ever reached; a lapse today never lowers it. */
  streakBest: number;
  onBack: () => void;
  onStartFirstRound: () => void;
}

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */

/** A group below this accuracy gets the almond bar and the "needs practice" flag. */
const WARN_ACCURACY = 0.6;

/** stats.html draws the streak row one size up from the home dashboard. */
const STATS_STAMP_PX = 30;

const SKILL_LABEL_KEYS = {
  small: 'stats.skill_small',
  tens: 'stats.skill_tens',
  hundreds: 'stats.skill_hundreds',
  big: 'stats.skill_big',
  prices: 'stats.skill_prices',
  weights: 'stats.skill_weights',
} as const satisfies Record<DisplayGroup, string>;

/* ------------------------------------------------------------------ *
 * Data
 * ------------------------------------------------------------------ */

interface StatsData {
  stats: SessionStats;
  stampDays: StreakStampDay[];
  stampedToday: boolean;
  totalAnswers: number;
  hasData: boolean;
}

function readStatsData(now: Date): StatsData {
  const settings = getSettings();
  const days = getDays();
  const progress = getProgress();
  const srs = deserializeSrs(getSrs()?.state);
  const today = localDayKey(now);
  const dailyGoal = effectiveDailyGoal(settings.dailyGoal);
  const stats = computeStats(srs, days, localMonthKey(now));
  const todayRow = days.find((day) => day.date === today);

  return {
    stats,
    stampDays: buildStreakWindow(days, dailyGoal, today),
    stampedToday: todayRow !== undefined && isGoalMet(todayRow, dailyGoal),
    // The durable lifetime counter, falling back to the SRS tally when a
    // restored backup carries buckets but no progress record.
    totalAnswers: progress.totalAnswered > 0 ? progress.totalAnswered : stats.totals.attempts,
    hasData:
      progress.totalAnswered > 0 ||
      stats.totals.attempts > 0 ||
      days.some((day) => day.answered > 0),
  };
}

/* ------------------------------------------------------------------ *
 * Glyphs
 * ------------------------------------------------------------------ */

/** The day-zero placeholder: an unstamped, slightly tilted stamp outline. */
function EmptyStampGlyph() {
  return (
    <span className="-rotate-8 flex size-16 items-center justify-center rounded-full border-2 border-border-strong border-dashed text-border-strong">
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 12.5l5.5 5.5L20 7" />
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Screen
 * ------------------------------------------------------------------ */

export function StatsScreen({
  streakCurrent,
  streakBest,
  onBack,
  onStartFirstRound,
}: StatsScreenProps) {
  const { t } = useTranslation();
  const data = useMemo(() => readStatsData(new Date()), []);

  const streakSub = !data.hasData
    ? t('stats.empty_streak_sub')
    : data.stampedToday
      ? t('home.streak_n', { count: streakCurrent })
      : t('stats.streak_today_sub', { count: streakCurrent });

  return (
    <div className="screen">
      <header className="safe-top flex items-center gap-3 px-screen pt-3 pb-1">
        <Button variant="icon" aria-label={t('common.back')} onClick={onBack}>
          <BackGlyph />
        </Button>
        <h1 className="font-bold font-display text-[26px]">{t('stats.title')}</h1>
      </header>

      <ScrollArea className="safe-bottom flex flex-col gap-3 px-screen pt-2 pb-6">
        <Card>
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-extrabold text-sub-strong">{t('stats.streak_label')}</span>
            {streakBest > 0 ? (
              <span className="font-semibold text-caption text-text-muted">
                {t('stats.streak_record', { count: streakBest })}
              </span>
            ) : null}
          </div>
          <StreakStamps days={data.stampDays} size={STATS_STAMP_PX} />
          <p className="font-semibold text-caption text-text-muted">{streakSub}</p>
        </Card>

        {data.hasData ? (
          <>
            <div className="flex gap-2.5">
              <Card className="flex-1">
                <div className="flex flex-col gap-0.5">
                  <span className="numerals font-bold font-display text-title-lg">
                    {formatNumber(data.totalAnswers)}
                  </span>
                  <span className="font-semibold text-caption text-text-muted">
                    {t('stats.total_answers_label')}
                  </span>
                </div>
              </Card>
              <Card className="flex-1">
                <div className="flex flex-col gap-0.5">
                  <span className="numerals font-bold font-display text-title-lg">
                    {Math.round(data.stats.month.accuracy * 100)}%
                  </span>
                  <span className="font-semibold text-caption text-text-muted">
                    {t('stats.accuracy_label')}
                  </span>
                </div>
              </Card>
            </div>

            <Card>
              <span className="font-extrabold text-sub-strong">{t('stats.skills_title')}</span>
              <div className="flex flex-col gap-3.5">
                {DISPLAY_GROUP_ORDER.map((group) => {
                  const stat = data.stats.groups[group];
                  const warn = stat.attempts > 0 && stat.accuracy < WARN_ACCURACY;
                  return (
                    <SkillBar
                      key={group}
                      label={t(SKILL_LABEL_KEYS[group])}
                      percent={Math.round(stat.accuracy * 100)}
                      warn={warn}
                      {...(warn
                        ? {
                            flag: (
                              <Chip variant="flag" className="ml-1.5">
                                {t('stats.needs_practice')}
                              </Chip>
                            ),
                          }
                        : {})}
                    />
                  );
                })}
              </div>
            </Card>

            <p className="text-center font-semibold text-overline text-text-muted leading-relaxed">
              {t('stats.auto_note')}
            </p>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
            <EmptyStampGlyph />
            <div className="flex flex-col gap-1.5">
              <h2 className="font-bold font-display text-[26px]">{t('stats.empty_title')}</h2>
              <p className="mx-auto max-w-[300px] font-semibold text-[14px] text-text-muted leading-relaxed">
                {t('stats.empty_sub')}
              </p>
            </div>
            <Button onClick={onStartFirstRound}>{t('stats.empty_cta')}</Button>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
