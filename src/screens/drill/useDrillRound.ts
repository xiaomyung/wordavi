import { useCallback, useEffect, useReducer, useRef } from 'react';
import { tick as hapticTick, wrongReveal } from '@/services/haptics';
import { playVerdict, setEnabled as setSoundsEnabled } from '@/services/sounds';
import type {
  AnswerRecord,
  Question,
  QuestionSource,
  RoundConfig,
  RoundSize,
  RoundState,
  RoundSummary,
  Score,
} from '@/session';
import {
  answerQuestion,
  buildRetryRound,
  closeRound,
  createRound,
  deserializeRound,
  deserializeSrs,
  finishRound,
  isRoundComplete,
  isRoundSerialized,
  nextQuestion,
  serializeRound,
  serializeSrs,
} from '@/session';
import type { SavedRound, Settings } from '@/storage';
import { getSettings, getSrs, setRound as saveRound, setSrs } from '@/storage';
import { commitAnswer, commitRound } from './commit-round';

/** Old prompt fade-out before the next question mounts (motion.md). */
export const SWAP_OUT_MS = 120;

export interface UseDrillRoundOptions {
  modeId: string;
  source: QuestionSource;
  /** Unfinished round from storage; ignored unless it belongs to this mode. */
  resume?: SavedRound | undefined;
  /** Replay this finished round's misses instead of generating fresh questions. */
  retryOf?: RoundSummary | undefined;
  onFinish: (summary: RoundSummary) => void;
}

export interface DrillRoundApi {
  /** The question on stage — stays put while its verdict is shown. */
  question: Question | null;
  /** Verdict for `question`, or null while it is still unanswered. */
  record: AnswerRecord | null;
  /** 1-based number of the question on stage. */
  step: number;
  size: RoundSize;
  score: Score;
  settings: Settings;
  /** True during the outgoing prompt's fade, before the next one mounts. */
  swapping: boolean;
  submit: (given: string) => void;
  /** "Дальше" — advances, or ends the round when it was the last question. */
  advance: () => void;
  /** Ends the round now (endless close button, graceful offline exit). */
  finish: () => void;
}

/**
 * Deterministic seed for `?seed=` drills — the hook Playwright uses to replay an
 * identical round. Falls back to the clock.
 */
function resolveSeed(): number {
  if (typeof location === 'undefined') return Date.now();
  const raw = new URLSearchParams(location.search).get('seed');
  if (raw === null) return Date.now();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function buildRound(options: UseDrillRoundOptions, settings: Settings): RoundState {
  const srs = deserializeSrs(getSrs()?.state);
  const { modeId, source, resume, retryOf } = options;

  const config: RoundConfig = {
    modeId,
    size: settings.roundSize,
    rangeMin: settings.rangeMin,
    rangeMax: settings.rangeMax,
    seed: resolveSeed(),
    acceptNoAccents: settings.acceptNoAccents,
  };

  // "Retry the missed" is an explicit ask and outranks anything parked: a retry
  // round replays a fixed list, so it never touches the source.
  if (retryOf !== undefined && retryOf.missed.length > 0) {
    return buildRetryRound(retryOf, config, srs);
  }

  if (resume !== undefined && resume.modeId === modeId && isRoundSerialized(resume.state)) {
    // A round that was already closed must not resume into a drill the learner
    // has ended; fall through to a fresh one.
    if (!resume.state.finished) {
      // Settings the learner may have changed while the round was parked are
      // handed back in: a narrowed number range has to govern the rest of the
      // round, not only the next one they start.
      return deserializeRound(resume.state, srs, source, {
        rangeMin: settings.rangeMin,
        rangeMax: settings.rangeMax,
        acceptNoAccents: settings.acceptNoAccents,
      });
    }
  }

  return createRound(config, srs, source);
}

/**
 * Round lifecycle for the drill screen: setup/resume, grading, persistence after
 * every answer — including, through {@link commitAnswer}, the day/streak roll-up
 * each answer earns — and the closing {@link commitRound} at the end.
 *
 * The authoritative round lives in a ref rather than state — timers, the
 * visibilitychange listener and the unmount flush all need the freshest value,
 * and a stale closure there would silently lose a learner's progress.
 */
export function useDrillRound(options: UseDrillRoundOptions): DrillRoundApi {
  const { modeId } = options;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const settingsRef = useRef<Settings | null>(null);
  settingsRef.current ??= getSettings();
  const settings = settingsRef.current;

  const roundRef = useRef<RoundState | null>(null);
  if (roundRef.current === null) {
    const built = buildRound(options, settings);
    // Serve the first question only for a round that has shown none yet; a
    // resumed round keeps whatever it was displaying (question or verdict).
    roundRef.current = built.served.length === 0 && !built.finished ? nextQuestion(built) : built;
  }

  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const finishedRef = useRef(false);
  const swappingRef = useRef(false);
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commit = useCallback(
    (next: RoundState) => {
      roundRef.current = next;
      forceRender();
    },
    // forceRender is a stable dispatch; useReducer guarantees it.
    [],
  );

  useEffect(() => {
    setSoundsEnabled(settings.soundsEnabled);
  }, [settings.soundsEnabled]);

  /* Persist an unfinished round so closing the tab mid-drill can be resumed. */
  useEffect(() => {
    const flush = (): void => {
      const state = roundRef.current;
      if (state === null || state.finished || finishedRef.current) return;
      saveRound(modeId, serializeRound(state));
    };
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [modeId]);

  useEffect(
    () => () => {
      if (swapTimerRef.current !== null) clearTimeout(swapTimerRef.current);
    },
    [],
  );

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    const state = roundRef.current;
    if (state === null) return;
    finishedRef.current = true;

    const closed = closeRound(state);
    commit(closed);
    const summary = finishRound(closed);

    commitRound(summary, closed.srs);

    optionsRef.current.onFinish(summary);
  }, [commit]);

  const submit = useCallback(
    (given: string) => {
      const state = roundRef.current;
      if (state === null || state.current === null || swappingRef.current) return;

      const outcome = answerQuestion(state, given);
      commit(outcome.state);

      setSrs(serializeSrs(outcome.state.srs));
      saveRound(modeId, serializeRound(outcome.state));
      // The day, the totals and the streak move with this answer, not with the
      // round it belongs to: a round left part-played still counted.
      commitAnswer(outcome.record, outcome.state.score);

      playVerdict(outcome.record.verdict);
      if (outcome.record.verdict === 'wrong') {
        wrongReveal();
      } else {
        hapticTick();
      }
    },
    [commit, modeId],
  );

  const advance = useCallback(() => {
    const state = roundRef.current;
    if (state === null || swappingRef.current) return;
    if (isRoundComplete(state)) {
      finish();
      return;
    }
    swappingRef.current = true;
    forceRender();
    swapTimerRef.current = setTimeout(() => {
      swapTimerRef.current = null;
      swappingRef.current = false;
      const live = roundRef.current;
      if (live !== null) commit(nextQuestion(live));
    }, SWAP_OUT_MS);
  }, [commit, finish]);

  const round = roundRef.current;
  const served = round.served;
  const records = round.records;
  const awaitingNext = served.length === records.length && records.length > 0;

  return {
    question: round.current ?? (awaitingNext ? (served.at(-1) ?? null) : null),
    record: awaitingNext ? (records.at(-1) ?? null) : null,
    step: round.step,
    size: round.config.size,
    score: round.score,
    settings,
    swapping: swappingRef.current,
    submit,
    advance,
    finish,
  };
}
