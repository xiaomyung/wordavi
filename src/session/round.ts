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
  isAnswerRecord,
  isDigitTarget,
  isQuestion,
  type LiveRoundConfig,
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

/**
 * Whether `source` claims a question it did not generate this round. A source
 * that does not answer the question takes everything, which is what a
 * single-mode test double and {@link NOOP_SOURCE} both want.
 */
function acceptsReplay(source: QuestionSource, question: Question): boolean {
  return source.canReplay?.(question) ?? true;
}

/**
 * Whether a question still sits inside the round's number range.
 *
 * Only a plain numeral is governed by the slider. A shelf price or a scale
 * weight has its own natural scale — clamping "medio kilo" to 0 – 100 would gut
 * the grocery mode (grocery.tsx), so those payloads always fit.
 *
 * The bounds are read in either order because the setting is two independent
 * handles; the fuller sanitising the generators do (flooring, clamping to what
 * the engine can spell) only ever narrows a span values were already drawn
 * from, so it cannot change the answer here.
 */
function fitsRange(question: Question, config: RoundConfig): boolean {
  const payload = question.prompt;
  if (payload.kind !== 'number') return true;
  return (
    payload.value >= Math.min(config.rangeMin, config.rangeMax) &&
    payload.value <= Math.max(config.rangeMin, config.rangeMax)
  );
}

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
    // A miss parked in the wrongQueue outlives the range it was made under, so
    // it is offered back only while it still fits: narrowing the slider to
    // 0 – 100 must not re-serve the 777 777 the learner missed last week.
    const due = pickDueWrongItem(
      state.srs,
      step,
      state.lastWrongQueueStep,
      (q) => acceptsReplay(state.source, q) && fitsRange(q, state.config),
    );
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

function isRoundConfig(value: unknown): value is RoundConfig {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.modeId === 'string' &&
    (v.size === 'endless' || Number.isFinite(v.size)) &&
    Number.isFinite(v.rangeMin) &&
    Number.isFinite(v.rangeMax) &&
    Number.isFinite(v.seed) &&
    (v.acceptNoAccents === undefined || typeof v.acceptNoAccents === 'boolean')
  );
}

function isScore(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return Number.isFinite(v.points) && Number.isFinite(v.combo) && Number.isFinite(v.bestCombo);
}

/**
 * Guard for the round slot. The questions inside are checked element by
 * element: the drill hands a resumed one straight to the matcher and to the
 * mode's zones, so a slot carrying even one malformed question is discarded
 * whole — that costs the learner an unfinished round, keeping it costs them
 * every round after it.
 */
export function isRoundSerialized(value: unknown): value is RoundSerialized {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    isRoundConfig(v.config) &&
    typeof v.rngDraws === 'number' &&
    typeof v.step === 'number' &&
    Array.isArray(v.served) &&
    v.served.every(isQuestion) &&
    Array.isArray(v.records) &&
    v.records.every(isAnswerRecord) &&
    isScore(v.score) &&
    typeof v.lastWrongQueueStep === 'number' &&
    typeof v.finished === 'boolean' &&
    typeof v.retry === 'boolean' &&
    Array.isArray(v.retryItems) &&
    v.retryItems.every(isQuestion)
  );
}

/**
 * Rehydrate a serialized round, re-injecting the live srs and (optional) source.
 *
 * `live` carries the settings the learner is allowed to change while a round is
 * parked; they replace what the round was started with. The round's own shape —
 * its length, its seed, the mode it belongs to — is not among them: those decide
 * what "question 7 of 20" already means, and re-reading them would rewrite a
 * round in progress rather than steer the rest of it.
 */
export function deserializeRound(
  data: RoundSerialized,
  srs: SrsState,
  source?: QuestionSource,
  live?: LiveRoundConfig,
): RoundState {
  const src = source ?? NOOP_SOURCE;
  const liveConfig: RoundConfig = live === undefined ? data.config : { ...data.config, ...live };
  const rng = makeCountingRng(liveConfig.seed, data.rngDraws);
  const served = [...data.served];
  let step = data.step;
  let current: Question | null = null;
  let dropped = false;

  if (served.length > data.records.length) {
    const pending = served.at(-1) ?? null;
    // Two ways the question on stage can be one this round must no longer ask:
    // the mode cannot present it, or the learner narrowed the range while the
    // round was parked. A retry replays a fixed list the learner asked for by
    // name, so only the first applies there.
    const usable =
      pending !== null &&
      acceptsReplay(src, pending) &&
      (data.retry || fitsRange(pending, liveConfig));
    if (pending !== null && !usable) {
      // It is the only thing the resumed drill would show — so drop it, together
      // with the `served` slot that finishRound pairs with a record by index,
      // and carry on at the next question.
      served.pop();
      step = Math.max(0, step - 1);
      dropped = true;
      slog('info', 'round.resume.drop', { id: pending.id });
    } else {
      current = pending;
    }
  }

  // A retry round takes its next question from `retryItems` instead of asking
  // the source, so an item the source refuses would be handed straight back —
  // dropping the served slot alone would leave the learner on it. The refused
  // items are therefore removed from the part of the list still to come; their
  // misses stay in the wrongQueue, which is where they wait for a round that can
  // grade them. `config.size` follows the list, the way buildRetryRound sets it,
  // so the progress the drill shows is the number of questions it will ask.
  const unserved = data.records.length + (current === null ? 0 : 1);
  const retryItems = data.retry
    ? [
        ...data.retryItems.slice(0, unserved),
        ...data.retryItems.slice(unserved).filter((item) => acceptsReplay(src, item)),
      ]
    : [...data.retryItems];
  const config =
    data.retry && retryItems.length !== data.retryItems.length
      ? { ...liveConfig, size: retryItems.length }
      : liveConfig;

  slog('info', 'round.resume', { step, answered: data.records.length });
  const state: RoundState = {
    config,
    rngDraws: data.rngDraws,
    step,
    current,
    served,
    records: [...data.records],
    score: { ...data.score },
    lastWrongQueueStep: data.lastWrongQueueStep,
    finished: data.finished,
    retry: data.retry,
    retryItems,
    srs,
    source: src,
    rng,
  };

  // Something had to be dropped, so put a usable question in its place right
  // here: the learner resumes on the step they left, rather than on the verdict
  // of the question before it, which reads as the round having rewound. Only a
  // real source can be asked to generate one — a rehydration with none (a stats
  // read, a preview) is left exactly as it is.
  const canAsk = state.retry || source !== undefined;
  return dropped && canAsk && !state.finished && !isRoundComplete(state)
    ? nextQuestion(state)
    : state;
}
