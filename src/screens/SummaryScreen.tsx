/**
 * Round summary — visual truth:
 * design-handoff/wordavi-design-v1/screens/summary.html (EN light + dark).
 *
 * Sequencing follows motion.md: the accuracy ring sweeps to its value over
 * 600ms and the day stamp pops 420ms after the ring lands. Nothing else moves
 * at the same time.
 */
import type { TFunction } from 'i18next';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, GoalRing, Stamp, StreakStamps } from '@/components';
import { formatNumber, formatPrice, formatWeight } from '@/engine';
import { dayStamp as hapticDayStamp } from '@/services/haptics';
import { playVerdict, isEnabled as soundsEnabled } from '@/services/sounds';
import type { Accepted, PromptPayload, RoundSummary, Verdict } from '@/session';
import { getSettings } from '@/storage';
import { localDayKey } from './streak-window';

/* ------------------------------------------------------------------ *
 * Props
 * ------------------------------------------------------------------ */

export interface SummaryDayState {
  /** Today's daily goal is met (the stamp belongs on the card). */
  goalMet: boolean;
  /** The stamp was already earned before this round — show it, but do not celebrate twice. */
  stampedToday: boolean;
  /** Current streak length, used for the "Day N stamped" line. */
  streakDays: number;
  /** Counted answers today and the daily goal. */
  done: number;
  total: number;
}

export interface SummaryScreenProps {
  summary: RoundSummary;
  dayState: SummaryDayState;
  onRetryMissed: () => void;
  onBackHome: () => void;
}

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */

/** motion.md: "Day stamp — 420ms after ring lands". */
const DAY_STAMP_DELAY_MS = 420;

/** Warm, never grading: the congratulation shows from a clearly good round up. */
const CONGRATS_ACCURACY = 0.6;

const MODE_TITLE_KEYS = {
  words: 'modes.words.title',
  digits: 'modes.digits.title',
  listen: 'modes.listen.title',
  choice: 'modes.choice.title',
  speak: 'modes.speak.title',
  grocery: 'modes.grocery.title',
} as const;

/* ------------------------------------------------------------------ *
 * Pure helpers
 * ------------------------------------------------------------------ */

function modeTitle(modeId: string, t: TFunction): string {
  const key = MODE_TITLE_KEYS[modeId as keyof typeof MODE_TITLE_KEYS];
  return key === undefined ? modeId : t(key);
}

/** The prompt as the drill showed it (Spanish content formatting, es-ES). */
function promptText(prompt: PromptPayload, t: TFunction): string {
  switch (prompt.kind) {
    case 'number':
      return formatNumber(prompt.value);
    case 'price':
      return formatPrice(prompt.euros, prompt.cents);
    case 'decimal':
      return `${formatNumber(prompt.intPart)},${prompt.fracDigits}`;
    case 'quantity': {
      const weight = formatWeight(prompt.grams);
      return `${weight.value} ${weight.unit === 'kg' ? t('units.kg') : t('units.g')}`;
    }
  }
}

/** The one answer the correction line prints: canonical words, or the digits. */
function canonicalAnswer(accepted: Accepted): string {
  if ('canonical' in accepted) return accepted.canonical;
  const digits = formatNumber(accepted.intVal);
  return accepted.fracDigits === undefined ? digits : `${digits},${accepted.fracDigits}`;
}

interface SummaryRow {
  key: string;
  verdict: Verdict;
  /** Only misses carry their prompt — a summary keeps the questions it missed. */
  prompt: string | null;
  given: string;
  correction: string | null;
}

interface SummaryRows {
  misses: SummaryRow[];
  rest: SummaryRow[];
}

/**
 * Split the round into "misses first, always visible" and everything else.
 * `finishRound` pushes `missed` in answer order, so the n-th wrong record and
 * the n-th missed question are the same question.
 */
function buildRows(summary: RoundSummary, t: TFunction): SummaryRows {
  const misses: SummaryRow[] = [];
  const rest: SummaryRow[] = [];
  let missIndex = 0;

  summary.verdicts.forEach((record, index) => {
    const key = `${record.questionId}-${index}`;
    if (record.verdict === 'wrong') {
      const question = summary.missed[missIndex];
      missIndex += 1;
      misses.push({
        key,
        verdict: 'wrong',
        prompt: question === undefined ? null : promptText(question.prompt, t),
        given: record.given,
        correction: question === undefined ? null : canonicalAnswer(question.accepted),
      });
      return;
    }
    rest.push({
      key,
      verdict: record.verdict,
      prompt: null,
      given: record.given,
      correction: null,
    });
  });

  return { misses, rest };
}

/* ------------------------------------------------------------------ *
 * Row
 * ------------------------------------------------------------------ */

function QuestionRow({ row }: { row: SummaryRow }) {
  const missed = row.verdict === 'wrong';

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="numerals w-14 shrink-0 font-bold font-display text-[17px]">
          {row.prompt}
        </span>
        <span className="flex-1 font-display text-[15px] text-text-muted italic" lang="es">
          {missed ? (
            <s className="font-sans font-semibold text-[14px] text-text-faint not-italic">
              {row.given}
            </s>
          ) : (
            row.given
          )}
        </span>
        <Stamp verdict={row.verdict} size={22} className="shrink-0" />
      </div>
      {row.correction === null ? null : (
        <p
          className="ml-[68px] px-4 pb-3 font-display text-[14.5px] text-wrong-text italic"
          lang="es"
        >
          {row.correction}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Screen
 * ------------------------------------------------------------------ */

export function SummaryScreen({
  summary,
  dayState,
  onRetryMissed,
  onBackHome,
}: SummaryScreenProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [stampShown, setStampShown] = useState(false);
  const [stampPops, setStampPops] = useState(false);
  const stampTimer = useRef<number | null>(null);

  const rows = useMemo(() => buildRows(summary, t), [summary, t]);
  // Sounds are opt-in; the service also gates itself, this keeps the screen
  // honest even when nothing has pushed the setting into it yet.
  const soundsOn = useMemo(() => getSettings().soundsEnabled || soundsEnabled(), []);
  const todayKey = useMemo(() => localDayKey(new Date()), []);

  useEffect(
    () => () => {
      if (stampTimer.current !== null) window.clearTimeout(stampTimer.current);
    },
    [],
  );

  function handleSweepEnd(): void {
    if (!dayState.goalMet || stampShown || stampTimer.current !== null) return;
    stampTimer.current = window.setTimeout(() => {
      stampTimer.current = null;
      setStampShown(true);
      if (dayState.stampedToday) return;
      setStampPops(true);
      hapticDayStamp();
      if (soundsOn) playVerdict('correct');
    }, DAY_STAMP_DELAY_MS);
  }

  const accuracyPercent = Math.round(summary.accuracy * 100);
  const hidden = expanded ? 0 : rows.rest.length;

  return (
    <div className="screen">
      <div className="screen-content safe-top safe-bottom flex flex-col gap-3 px-screen pt-4 pb-6">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="font-bold font-display text-title-lg">{t('summary.title')}</h1>
          <p className="font-semibold text-sub text-text-muted">
            {t('summary.subtitle', { mode: modeTitle(summary.modeId, t), count: summary.total })}
          </p>
        </div>

        <Card>
          <div className="flex items-center gap-3.5">
            <GoalRing
              value={summary.correctCount}
              max={summary.total}
              size="lg"
              sweep
              onSweepEnd={handleSweepEnd}
            >
              <span className="numerals font-extrabold text-correct-text text-sub-strong">
                {accuracyPercent}%
              </span>
            </GoalRing>
            <div className="flex flex-col gap-0.5">
              <span className="numerals font-bold font-display text-[27px] leading-none">
                {t('home.goal_sub', { done: summary.correctCount, total: summary.total })}
              </span>
              <span className="numerals font-semibold text-sub text-text-muted">
                {t('summary.score_line', { points: summary.points, combo: summary.bestCombo })}
              </span>
              {summary.accuracy >= CONGRATS_ACCURACY ? (
                <span
                  className="font-display font-semibold text-[16px] text-correct-text italic"
                  lang="es"
                >
                  {t('summary.congrats')}
                </span>
              ) : null}
            </div>
          </div>

          {dayState.goalMet && stampShown ? (
            <div className="flex items-center gap-2 border-border border-t border-dashed pt-3">
              <StreakStamps
                days={[{ seedKey: todayKey, state: 'done' }]}
                {...(stampPops ? { popIndex: 0 } : {})}
              />
              <span className="font-bold text-sub">
                {t('summary.day_stamped', {
                  day: dayState.streakDays,
                  done: dayState.done,
                  total: dayState.total,
                })}
              </span>
            </div>
          ) : null}
        </Card>

        <Card variant="grouped" className="overflow-hidden">
          {rows.misses.map((row) => (
            <QuestionRow key={row.key} row={row} />
          ))}
          {expanded ? rows.rest.map((row) => <QuestionRow key={row.key} row={row} />) : null}
          {hidden > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="w-full px-4 py-2.5 text-center font-semibold text-caption text-text-faint"
            >
              {t('summary.and_more', { n: hidden })}
            </button>
          ) : null}
        </Card>

        {summary.wrongCount > 0 ? (
          <Button className="w-full" onClick={onRetryMissed}>
            {t('summary.retry_missed', { n: summary.wrongCount })}
          </Button>
        ) : null}
        <Button variant="ghost" onClick={onBackHome}>
          {t('summary.back_home')}
        </Button>
      </div>
    </div>
  );
}
