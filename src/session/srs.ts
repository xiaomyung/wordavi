import type { Rng } from '@/engine';
import { slog } from './log';
import {
  type BucketStat,
  type PromptPayload,
  type Question,
  SKILL_BUCKETS,
  type SkillBucket,
  type SrsState,
  type Verdict,
  type WrongQueueItem,
} from './types';

/* ------------------------------------------------------------------ *
 * Bucket classifier
 * ------------------------------------------------------------------ *
 * Each question maps to exactly ONE primary bucket by its most significant
 * feature. Numbers are classified by magnitude/shape; other payloads by kind.
 *
 *   0-15                          -> d0_15
 *   16-19                         -> teens_fused
 *   20-29                         -> twenties_fused
 *   30-99, multiple of 10         -> tens_round
 *   30-99, otherwise              -> tens_y
 *   100-999, hundreds digit 5/7/9 -> hundreds_irreg  (quinientos/setecientos/novecientos)
 *   100-999, otherwise            -> hundreds_reg
 *   1_000-999_999                 -> thousands
 *   >= 1_000_000                  -> millions
 *   price payload                 -> price_cents
 *   decimal payload               -> decimals
 *   quantity, grams % 250 === 0   -> qty_fractions  (cuarto/medio/kilo phrasings)
 *   quantity, otherwise           -> qty_grams
 */

export function classifyNumber(value: number): SkillBucket {
  const n = Math.abs(Math.trunc(value));
  if (n <= 15) return 'd0_15';
  if (n <= 19) return 'teens_fused';
  if (n <= 29) return 'twenties_fused';
  if (n <= 99) return n % 10 === 0 ? 'tens_round' : 'tens_y';
  if (n <= 999) {
    const hundreds = Math.floor(n / 100);
    return hundreds === 5 || hundreds === 7 || hundreds === 9 ? 'hundreds_irreg' : 'hundreds_reg';
  }
  if (n <= 999_999) return 'thousands';
  return 'millions';
}

export function classifyBucket(prompt: PromptPayload): SkillBucket {
  switch (prompt.kind) {
    case 'number':
      return classifyNumber(prompt.value);
    case 'price':
      return 'price_cents';
    case 'decimal':
      return 'decimals';
    case 'quantity':
      return prompt.grams > 0 && prompt.grams % 250 === 0 ? 'qty_fractions' : 'qty_grams';
  }
}

/* ------------------------------------------------------------------ *
 * State init / clone
 * ------------------------------------------------------------------ */

function emptyBucket(): BucketStat {
  return { attempts: 0, correct: 0, last20: [] };
}

export function initSrs(): SrsState {
  const buckets = {} as Record<SkillBucket, BucketStat>;
  for (const bucket of SKILL_BUCKETS) buckets[bucket] = emptyBucket();
  return { version: 1, answeredCount: 0, buckets, wrongQueue: [] };
}

/** Deep copy of a question — they are plain JSON and get stored/replayed. */
export function cloneQuestion(q: Question): Question {
  return typeof structuredClone === 'function'
    ? structuredClone(q)
    : (JSON.parse(JSON.stringify(q)) as Question);
}

function cloneSrs(srs: SrsState): SrsState {
  const buckets = {} as Record<SkillBucket, BucketStat>;
  for (const bucket of SKILL_BUCKETS) {
    const s = srs.buckets[bucket] ?? emptyBucket();
    buckets[bucket] = { attempts: s.attempts, correct: s.correct, last20: [...s.last20] };
  }
  const wrongQueue = srs.wrongQueue.map((it) => ({
    question: cloneQuestion(it.question),
    reappearances: it.reappearances,
    consecutiveCorrect: it.consecutiveCorrect,
    dueAt: it.dueAt,
  }));
  return { version: 1, answeredCount: srs.answeredCount, buckets, wrongQueue };
}

/* ------------------------------------------------------------------ *
 * Weight & mastery
 * ------------------------------------------------------------------ */

export const WRONG_QUEUE_CAP = 50;

/**
 * A wrongQueue item may be injected at most once every three served questions,
 * so a rough patch never turns the round into a re-test. Rounds start at
 * `-WRONG_QUEUE_MIN_GAP` so the very first question is already eligible.
 */
export const WRONG_QUEUE_MIN_GAP = 3;

/** Consecutive non-wrong answers that retire a wrongQueue item. */
const QUEUE_EXIT_STREAK = 2;

/** How many recent answers per bucket feed accuracy/error rate. */
const LAST20_WINDOW = 20;
/** Mastery needs this accuracy over the window AND this many lifetime attempts. */
const MASTERY_ACCURACY = 0.9;
const MASTERY_MIN_ATTEMPTS = 10;
/** Weight multiplier applied to a bucket's error rate. */
const ERROR_WEIGHT = 3;
const MASTERY_FLOOR = 0.2;

export function accuracyOf(stat: BucketStat): number {
  if (stat.last20.length === 0) return 0;
  const correct = stat.last20.filter((ok) => ok).length;
  return correct / stat.last20.length;
}

export function errorRateOf(stat: BucketStat): number {
  if (stat.last20.length === 0) return 0;
  const wrong = stat.last20.filter((ok) => !ok).length;
  return wrong / stat.last20.length;
}

/** masteryFloor = 0.2 when accuracy >= 90% over last 20 AND attempts >= 10, else 1. */
export function masteryFloorOf(stat: BucketStat): number {
  return accuracyOf(stat) >= MASTERY_ACCURACY && stat.attempts >= MASTERY_MIN_ATTEMPTS
    ? MASTERY_FLOOR
    : 1;
}

/** weight = (1 + 3 * errorRate) * masteryFloor. */
export function weightOf(stat: BucketStat): number {
  return (1 + ERROR_WEIGHT * errorRateOf(stat)) * masteryFloorOf(stat);
}

export function bucketWeight(srs: SrsState, bucket: SkillBucket): number {
  return weightOf(srs.buckets[bucket] ?? emptyBucket());
}

/**
 * Weighted draw over the eligible buckets (heavier = shakier / less mastered).
 * Consumes exactly one rng draw, which the round counts for deterministic resume.
 */
export function pickBucket(rng: Rng, srs: SrsState, eligible: readonly SkillBucket[]): SkillBucket {
  if (eligible.length === 0) {
    throw new Error('pickBucket: no eligible buckets');
  }
  // Weights are always positive (mastery floor 0.2 is the minimum), so the
  // engine's weighted draw can never fall through to its throwing path.
  return rng.weighted(eligible.map((bucket) => [bucket, bucketWeight(srs, bucket)] as const));
}

/* ------------------------------------------------------------------ *
 * wrongQueue scheduling
 * ------------------------------------------------------------------ */

/** Due delay by reappearance count: first 3 questions, then 8, then 20. */
export function dueDelay(reappearances: number): number {
  if (reappearances <= 0) return 3;
  if (reappearances === 1) return 8;
  return 20;
}

function stripFlag(q: Question): Question {
  const clone = cloneQuestion(q);
  delete clone.fromWrongQueue;
  return clone;
}

function pushWrong(srs: SrsState, q: Question): void {
  srs.wrongQueue.push({
    question: stripFlag(q),
    reappearances: 0,
    consecutiveCorrect: 0,
    dueAt: srs.answeredCount + dueDelay(0),
  });
  if (srs.wrongQueue.length > WRONG_QUEUE_CAP) {
    srs.wrongQueue.splice(0, srs.wrongQueue.length - WRONG_QUEUE_CAP);
  }
  slog('debug', 'srs.wrongQueue.push', { id: q.id, size: srs.wrongQueue.length });
}

/**
 * Select the most-overdue wrongQueue item, honoring the round-local ≤1-per-3
 * pacing (a gap of at least 3 served questions since the last injection).
 */
export function pickDueWrongItem(
  srs: SrsState,
  step: number,
  lastWrongQueueStep: number,
): WrongQueueItem | null {
  if (step - lastWrongQueueStep < WRONG_QUEUE_MIN_GAP) return null;
  let best: WrongQueueItem | null = null;
  for (const it of srs.wrongQueue) {
    if (srs.answeredCount >= it.dueAt && (best === null || it.dueAt < best.dueAt)) {
      best = it;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ *
 * Update on answer
 * ------------------------------------------------------------------ */

/**
 * Fold an answered question into SRS: bucket stats, global answered-count, and
 * wrongQueue lifecycle. Returns a new state (immutable).
 */
export function updateSrsOnAnswer(srs: SrsState, q: Question, verdict: Verdict): SrsState {
  const nonWrong = verdict !== 'wrong';
  const next = cloneSrs(srs);
  next.answeredCount += 1;

  const stat = next.buckets[q.bucket] ?? emptyBucket();
  stat.attempts += 1;
  if (nonWrong) stat.correct += 1;
  stat.last20 = [...stat.last20, nonWrong].slice(-LAST20_WINDOW);
  next.buckets[q.bucket] = stat;

  const idx = next.wrongQueue.findIndex((it) => it.question.id === q.id);
  if (idx >= 0) {
    const item = next.wrongQueue[idx] as WrongQueueItem;
    // A miss resets the streak; either way an item that stays in the queue is
    // rescheduled by its (now higher) reappearance count.
    const consecutiveCorrect = nonWrong ? item.consecutiveCorrect + 1 : 0;
    if (consecutiveCorrect >= QUEUE_EXIT_STREAK) {
      next.wrongQueue.splice(idx, 1);
      slog('debug', 'srs.wrongQueue.exit', { id: q.id });
    } else {
      item.consecutiveCorrect = consecutiveCorrect;
      item.reappearances += 1;
      item.dueAt = next.answeredCount + dueDelay(item.reappearances);
    }
  } else if (verdict === 'wrong') {
    pushWrong(next, q);
  }

  slog('debug', 'srs.update', { bucket: q.bucket, verdict, answered: next.answeredCount });
  return next;
}

/* ------------------------------------------------------------------ *
 * Serialization (srs storage slot)
 * ------------------------------------------------------------------ */

export function serializeSrs(srs: SrsState): SrsState {
  return cloneSrs(srs);
}

function isBucketStat(value: unknown): value is BucketStat {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.attempts === 'number' &&
    typeof v.correct === 'number' &&
    Array.isArray(v.last20) &&
    v.last20.every((x) => typeof x === 'boolean')
  );
}

/** Validate + rehydrate the srs slot; returns a fresh state on corruption. */
export function deserializeSrs(value: unknown): SrsState {
  if (typeof value !== 'object' || value === null) return initSrs();
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || typeof v.answeredCount !== 'number') return initSrs();
  if (typeof v.buckets !== 'object' || v.buckets === null) return initSrs();
  if (!Array.isArray(v.wrongQueue)) return initSrs();

  const rawBuckets = v.buckets as Record<string, unknown>;
  const buckets = {} as Record<SkillBucket, BucketStat>;
  for (const bucket of SKILL_BUCKETS) {
    const stat = rawBuckets[bucket];
    buckets[bucket] = isBucketStat(stat)
      ? {
          attempts: stat.attempts,
          correct: stat.correct,
          last20: stat.last20.slice(-LAST20_WINDOW),
        }
      : emptyBucket();
  }

  const wrongQueue: WrongQueueItem[] = [];
  for (const raw of v.wrongQueue) {
    if (typeof raw !== 'object' || raw === null) continue;
    const it = raw as Record<string, unknown>;
    if (
      typeof it.reappearances === 'number' &&
      typeof it.consecutiveCorrect === 'number' &&
      typeof it.dueAt === 'number' &&
      typeof it.question === 'object' &&
      it.question !== null
    ) {
      wrongQueue.push({
        question: it.question as Question,
        reappearances: it.reappearances,
        consecutiveCorrect: it.consecutiveCorrect,
        dueAt: it.dueAt,
      });
    }
  }

  return { version: 1, answeredCount: v.answeredCount, buckets, wrongQueue };
}
