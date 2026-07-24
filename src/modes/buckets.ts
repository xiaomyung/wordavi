import { generateNumber, type NumberRange, type Rng } from '@/engine';
import {
  type Accepted,
  classifyNumber,
  type Question,
  type QuestionSource,
  type RoundConfig,
  type SkillBucket,
} from '@/session';

/**
 * Bucket → value-range mapping for the five number modes (words, digits,
 * listen, choice, speak). This is where the SRS pays off: the round picks a
 * shaky {@link SkillBucket}, and this module turns that bucket into a value of
 * exactly that shape, inside the learner's configured range.
 *
 * | bucket          | values drawn                                  | how            |
 * |-----------------|-----------------------------------------------|----------------|
 * | d0_15           | 0 – 15                                        | enumerate+pick |
 * | teens_fused     | 16 – 19 (dieciséis … diecinueve)              | enumerate+pick |
 * | twenties_fused  | 20 – 29 (veinte … veintinueve)                | enumerate+pick |
 * | tens_round      | 30, 40, … 90                                  | enumerate+pick |
 * | tens_y          | 31 – 99 non-round (treinta y uno …)           | enumerate+pick |
 * | hundreds_reg    | 100 – 899 with hundreds digit 1,2,3,4,6,8     | enumerate+pick |
 * | hundreds_irreg  | 500 – 999 with hundreds digit 5,7,9           | enumerate+pick |
 * | thousands       | 1 000 – 999 999                               | generateNumber |
 * | millions        | 1 000 000 – 999 999 999 999                   | generateNumber |
 *
 * Membership is never re-derived here: a candidate belongs to a bucket iff the
 * session's own {@link classifyNumber} says so, which is also what the round
 * uses to stamp `Question.bucket`. The two can therefore never disagree.
 *
 * Sub-thousand buckets enumerate their (at most 900) candidates and draw one
 * uniformly — one rng draw, uniform across hundreds families. The two big
 * buckets delegate to the engine's digit-band-balanced {@link generateNumber}
 * so a 0 – 1 000 000 range does not turn into a 6-digit-only drill.
 *
 * Buckets that no v1 mode claims: `decimals` (no mode emits a `decimal`
 * payload — decimal readings reach the learner as prices "dos con treinta y
 * cinco" and decimal-kg weights "uno coma dos kilos", which classify as
 * `price_cents` / `qty_grams`). See grocery.tsx for the price/quantity buckets.
 */

/** Largest integer the engine can spell (engine/numbers.ts MAX). */
const ENGINE_MAX = 999_999_999_999;

/** Buckets reachable from a plain `{ kind: 'number' }` prompt, in learning order. */
export const NUMBER_BUCKETS = [
  'd0_15',
  'teens_fused',
  'twenties_fused',
  'tens_round',
  'tens_y',
  'hundreds_reg',
  'hundreds_irreg',
  'thousands',
  'millions',
] as const satisfies readonly SkillBucket[];

export type NumberBucket = (typeof NUMBER_BUCKETS)[number];

/** Coarse span of each number bucket, before the round's range is applied. */
const SPAN: Record<NumberBucket, NumberRange> = {
  d0_15: { min: 0, max: 15 },
  teens_fused: { min: 16, max: 19 },
  twenties_fused: { min: 20, max: 29 },
  tens_round: { min: 30, max: 90 },
  tens_y: { min: 31, max: 99 },
  hundreds_reg: { min: 100, max: 899 },
  hundreds_irreg: { min: 500, max: 999 },
  thousands: { min: 1_000, max: 999_999 },
  millions: { min: 1_000_000, max: ENGINE_MAX },
};

/** Buckets small enough to enumerate; the rest sample their (clipped) span. */
const ENUMERATED: ReadonlySet<NumberBucket> = new Set([
  'd0_15',
  'teens_fused',
  'twenties_fused',
  'tens_round',
  'tens_y',
  'hundreds_reg',
  'hundreds_irreg',
]);

/** How a bucket will produce a value once the round's range is known. */
type BucketPlan = { list: readonly number[] } | { span: NumberRange };

export function isNumberBucket(bucket: SkillBucket): bucket is NumberBucket {
  return (NUMBER_BUCKETS as readonly SkillBucket[]).includes(bucket);
}

/** The learner's configured range, sanitised into an engine-safe span. */
export function roundRange(config: RoundConfig): NumberRange {
  const lo = Math.floor(Math.min(config.rangeMin, config.rangeMax));
  const hi = Math.floor(Math.max(config.rangeMin, config.rangeMax));
  return { min: Math.max(0, lo), max: Math.min(Math.max(0, hi), ENGINE_MAX) };
}

/**
 * How `bucket` would generate inside `range`, or null when the two do not
 * overlap on any value of the bucket's shape (e.g. `hundreds_irreg` against a
 * 0 – 100 range: 500/700/900 families are all out).
 */
export function planFor(bucket: NumberBucket, range: NumberRange): BucketPlan | null {
  const span = SPAN[bucket];
  const lo = Math.max(span.min, range.min);
  const hi = Math.min(span.max, range.max);
  if (lo > hi) return null;
  if (!ENUMERATED.has(bucket)) return { span: { min: lo, max: hi } };
  const list: number[] = [];
  for (let value = lo; value <= hi; value++) {
    if (classifyNumber(value) === bucket) list.push(value);
  }
  return list.length > 0 ? { list } : null;
}

/** Draw one value from a plan. Consumes 1 rng draw (list) or 2 (span). */
function drawFrom(rng: Rng, plan: BucketPlan): number {
  return 'list' in plan ? rng.pick(plan.list) : generateNumber(rng, plan.span);
}

/**
 * Draw a value of `bucket`'s shape inside `range`, or null when the bucket has
 * no such value. Exported for the per-bucket generation tests.
 */
export function drawForBucket(rng: Rng, bucket: NumberBucket, range: NumberRange): number | null {
  const plan = planFor(bucket, range);
  return plan === null ? null : drawFrom(rng, plan);
}

/** Stable question id: same mode + same value = same SRS/wrongQueue item. */
export function numberQuestionId(modeId: string, value: number): string {
  return `${modeId}:n${value}`;
}

/**
 * The shared {@link QuestionSource} of every number mode. `accepted` is the
 * only thing that differs between them: word modes grade against the engine's
 * spelling set, digit modes against the integer.
 */
export function numberSource(
  modeId: string,
  accepted: (value: number) => Accepted,
): QuestionSource {
  return {
    eligibleBuckets(config: RoundConfig): readonly SkillBucket[] {
      const range = roundRange(config);
      const eligible = NUMBER_BUCKETS.filter((bucket) => planFor(bucket, range) !== null);
      // The buckets tile [0, ENGINE_MAX], so this can only be hit by a range
      // the sanitiser could not rescue; d0_15 keeps the round answerable.
      return eligible.length > 0 ? eligible : ['d0_15'];
    },
    generate(rng, ctx): Question {
      const range = roundRange(ctx.config);
      const suggested = ctx.suggestedBucket;
      const plan = isNumberBucket(suggested) ? planFor(suggested, range) : null;
      const value = plan === null ? generateNumber(rng, range) : drawFrom(rng, plan);
      return {
        id: numberQuestionId(modeId, value),
        bucket: classifyNumber(value),
        prompt: { kind: 'number', value },
        accepted: accepted(value),
      };
    },
  };
}
