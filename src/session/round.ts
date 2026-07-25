import { type AcceptedAnswer, matchText, type NoteKey, parseDigitAnswer } from '@/engine';
import { slog } from './log';
import { makeCountingRng } from './rng';
import { applyVerdict, initScore } from './score';
import {
  classifyBucket,
  cloneQuestion,
  pickBucket,
  pickDueWrongItem,
  updateSrsOnAnswer,
  WRONG_QUEUE_MIN_GAP,
} from './srs';
import {
  type AnswerRecord,
  isDigitTarget,
  type Question,
  type QuestionContext,
  type QuestionSource,
  type RoundConfig,
  type RoundSerialized,
  type RoundState,
  type RoundSummary,
  type SrsState,
  type Verdict,
} from './types';

/**
 * How much history {@link QuestionContext.recentQuestionIds} carries. Two are
 * enough for the mixed mode's anti-streak rule; a slightly longer window leaves
 * room for a source that wants more without touching this layer again.
 */
const RECENT_QUESTION_IDS = 5;

/** No-op source for retry/resumed rounds that never call generate(). */
const NOOP_SOURCE: QuestionSource = {
  eligibleBuckets: () => [],
  generate: () => {
    throw new Error('round: question source not available (retry/resumed round)');
  },
};

/* ------------------------------------------------------------------ *
 * Verdict computation
 * ------------------------------------------------------------------ */

/** Normalize an answer to the string the engine parses (es-ES comma decimal). */
function toGivenString(given: string | number): string {
  return typeof given === 'number' ? String(given).replace('.', ',') : given;
}

/** Trailing zeros carry no value: "2,50" and "2,5" are the same amount. */
function significantFrac(digits: string | undefined): string {
  return (digits ?? '').replace(/0+$/, '');
}

/**
 * Grade an answer. Digit-typed questions are compared numerically against the
 * engine's tolerant parser (spaces/dots group thousands, one comma separates
 * decimals); everything else goes to the engine matcher, whose verdict this
 * layer adopts verbatim.
 */
function computeVerdict(
  q: Question,
  given: string,
  acceptNoAccents: boolean,
): { verdict: Verdict; noteKey?: NoteKey } {
  if (isDigitTarget(q.accepted)) {
    const parsed = parseDigitAnswer(given);
    if (parsed === null) return { verdict: 'wrong' };
    const frac = 'fracDigits' in parsed ? parsed.fracDigits : undefined;
    const ok =
      parsed.intVal === q.accepted.intVal &&
      significantFrac(frac) === significantFrac(q.accepted.fracDigits);
    return { verdict: ok ? 'correct' : 'wrong' };
  }
  const result = matchText(q.accepted as AcceptedAnswer, given, { acceptNoAccents });
  return result.noteKey === undefined
    ? { verdict: result.verdict }
    : { verdict: result.verdict, noteKey: result.noteKey };
}

/* ------------------------------------------------------------------ *
 * Round lifecycle
 * ------------------------------------------------------------------ */

export function createRound(
  config: RoundConfig,
  srs: SrsState,
  source: QuestionSource,
): RoundState {
  const rng = makeCountingRng(config.seed, 0);
  slog('info', 'round.start', { modeId: config.modeId, size: config.size, seed: config.seed });
  return {
    config,
    rngDraws: 0,
    step: 0,
    current: null,
    served: [],
    records: [],
    score: initScore(),
    lastWrongQueueStep: -WRONG_QUEUE_MIN_GAP,
    finished: false,
    retry: false,
    retryItems: [],
    srs,
    source,
    rng,
  };
}

export function isRoundComplete(state: RoundState): boolean {
  if (state.retry) return state.records.length >= state.retryItems.length;
  if (state.config.size === 'endless') return false;
  return state.records.length >= state.config.size;
}

/** True when the current question has been served but not yet answered. */
function hasPendingQuestion(state: RoundState): boolean {
  return state.current !== null && state.served.length > state.records.length;
}

/**
 * Produce the next question: retry rounds replay their fixed items; normal rounds
 * inject a due wrongQueue item (≤1 per 3) or ask the source to generate for an
 * SRS-weighted bucket.
 */
export function nextQuestion(state: RoundState): RoundState {
  if (state.finished || isRoundComplete(state) || hasPendingQuestion(state)) {
    return state;
  }
  const step = state.step + 1;
  let question: Question;
  let lastWrongQueueStep = state.lastWrongQueueStep;

  if (state.retry) {
    const item = state.retryItems[state.step];
    if (item === undefined) return state;
    question = item;
  } else {
    const due = pickDueWrongItem(state.srs, step, state.lastWrongQueueStep);
    if (due !== null) {
      question = { ...due.question, fromWrongQueue: true };
      lastWrongQueueStep = step;
      slog('debug', 'round.wrongQueue.inject', { id: question.id, bucket: question.bucket });
    } else {
      const eligible = state.source.eligibleBuckets(state.config);
      const suggestedBucket = pickBucket(state.rng.rng, state.srs, eligible);
      const ctx: QuestionContext = {
        suggestedBucket,
        config: state.config,
        recentQuestionIds: state.served.slice(-RECENT_QUESTION_IDS).map((q) => q.id),
      };
      const generated = state.source.generate(state.rng.rng, ctx);
      question = { ...generated, bucket: classifyBucket(generated.prompt) };
    }
  }

  slog('debug', 'round.next', { step, bucket: question.bucket, kind: question.prompt.kind });
  return {
    ...state,
    step,
    current: question,
    served: [...state.served, question],
    lastWrongQueueStep,
    rngDraws: state.rng.draws(),
  };
}

export interface AnswerOutcome {
  state: RoundState;
  record: AnswerRecord;
}

/** Grade the current question, updating score, SRS and records. */
export function answerQuestion(state: RoundState, given: string | number): AnswerOutcome {
  const q = state.current;
  if (q === null) {
    throw new Error('answerQuestion: no current question');
  }
  const givenStr = toGivenString(given);
  const { verdict, noteKey } = computeVerdict(q, givenStr, state.config.acceptNoAccents ?? true);
  const score = applyVerdict(state.score, verdict);
  const srs = updateSrsOnAnswer(state.srs, q, verdict);
  const record: AnswerRecord = {
    questionId: q.id,
    bucket: q.bucket,
    given: givenStr,
    verdict,
    fromWrongQueue: q.fromWrongQueue === true,
    ...(noteKey !== undefined ? { noteKey } : {}),
  };
  slog('info', 'round.answer', { id: q.id, bucket: q.bucket, verdict });
  return {
    state: { ...state, current: null, records: [...state.records, record], score, srs },
    record,
  };
}

export function finishRound(state: RoundState): RoundSummary {
  const total = state.records.length;
  let correctCount = 0;
  let almostCount = 0;
  let wrongCount = 0;
  const missed: Question[] = [];
  state.records.forEach((record, i) => {
    if (record.verdict === 'wrong') {
      wrongCount += 1;
      const q = state.served[i];
      if (q !== undefined) missed.push(q);
    } else {
      correctCount += 1;
      if (record.verdict === 'almost') almostCount += 1;
    }
  });
  const accuracy = total === 0 ? 0 : correctCount / total;
  slog('info', 'round.finish', {
    total,
    accuracy,
    points: state.score.points,
    bestCombo: state.score.bestCombo,
    missed: missed.length,
  });
  return {
    modeId: state.config.modeId,
    size: state.config.size,
    total,
    correctCount,
    almostCount,
    wrongCount,
    accuracy,
    points: state.score.points,
    bestCombo: state.score.bestCombo,
    verdicts: [...state.records],
    missed,
  };
}

/**
 * Build a retry round from a summary's misses (wrong verdicts only — 'almost'
 * counts as correct). Full-fledged: feeds SRS, goal and score. Chains until clean
 * (caller loops: finish -> if missed, buildRetryRound again).
 */
export function buildRetryRound(
  summary: RoundSummary,
  config: RoundConfig,
  srs: SrsState,
): RoundState {
  const retryItems = summary.missed.map((q) => ({ ...cloneQuestion(q), fromWrongQueue: true }));
  const retryConfig: RoundConfig = {
    ...config,
    // A retry is exactly as long as the miss list — the reason RoundSize allows
    // any count rather than only the fixed 10/20/30 offered on the start screen.
    size: retryItems.length,
    seed: config.seed + 1,
  };
  slog('info', 'round.retry.build', { count: retryItems.length });
  return {
    config: retryConfig,
    rngDraws: 0,
    step: 0,
    current: null,
    served: [],
    records: [],
    score: initScore(),
    lastWrongQueueStep: -WRONG_QUEUE_MIN_GAP,
    finished: false,
    retry: true,
    retryItems,
    srs,
    source: NOOP_SOURCE,
    rng: makeCountingRng(retryConfig.seed, 0),
  };
}

/**
 * Close a round: `finishRound` is a pure read that may be called for a preview,
 * this is what marks the round over so a serialized endless round does not resume
 * into a drill the learner already ended.
 */
export function closeRound(state: RoundState): RoundState {
  if (state.finished) return state;
  slog('info', 'round.close', { modeId: state.config.modeId, answered: state.records.length });
  return { ...state, current: null, finished: true };
}

/* ------------------------------------------------------------------ *
 * Serialization (round storage slot; srs + source re-injected on resume)
 * ------------------------------------------------------------------ */

export function serializeRound(state: RoundState): RoundSerialized {
  return {
    version: 1,
    config: state.config,
    rngDraws: state.rngDraws,
    step: state.step,
    served: state.served,
    records: state.records,
    score: state.score,
    lastWrongQueueStep: state.lastWrongQueueStep,
    finished: state.finished,
    retry: state.retry,
    retryItems: state.retryItems,
  };
}

export function isRoundSerialized(value: unknown): value is RoundSerialized {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    typeof v.config === 'object' &&
    v.config !== null &&
    typeof v.rngDraws === 'number' &&
    typeof v.step === 'number' &&
    Array.isArray(v.served) &&
    Array.isArray(v.records) &&
    typeof v.score === 'object' &&
    v.score !== null &&
    typeof v.lastWrongQueueStep === 'number' &&
    typeof v.finished === 'boolean' &&
    typeof v.retry === 'boolean' &&
    Array.isArray(v.retryItems)
  );
}

/** Rehydrate a serialized round, re-injecting the live srs and (optional) source. */
export function deserializeRound(
  data: RoundSerialized,
  srs: SrsState,
  source?: QuestionSource,
): RoundState {
  const rng = makeCountingRng(data.config.seed, data.rngDraws);
  const pending = data.served.length > data.records.length;
  const current = pending ? (data.served.at(-1) ?? null) : null;
  slog('info', 'round.resume', { step: data.step, answered: data.records.length });
  return {
    config: data.config,
    rngDraws: data.rngDraws,
    step: data.step,
    current,
    served: [...data.served],
    records: [...data.records],
    score: { ...data.score },
    lastWrongQueueStep: data.lastWrongQueueStep,
    finished: data.finished,
    retry: data.retry,
    retryItems: [...data.retryItems],
    srs,
    source: source ?? NOOP_SOURCE,
    rng,
  };
}
