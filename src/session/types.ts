import type { AcceptedAnswer, AnswerVariant, NoteKey, Rng, VerdictKind } from '@/engine';

/* ------------------------------------------------------------------ *
 * Skill buckets & display groups
 * ------------------------------------------------------------------ */

export type SkillBucket =
  | 'd0_15'
  | 'teens_fused' // 16-19
  | 'twenties_fused' // 20-29
  | 'tens_y' // 31-99 non-round (uses "y": treinta y uno …)
  | 'tens_round' // 30, 40, … 90
  | 'hundreds_reg' // 100-499, 600-699, 800-899
  | 'hundreds_irreg' // 500/700/900 families (quinientos/setecientos/novecientos)
  | 'thousands' // 1_000 - 999_999
  | 'millions' // >= 1_000_000
  | 'decimals'
  | 'price_cents'
  | 'qty_fractions' // medio/cuarto/kilo phrasings
  | 'qty_grams'; // arbitrary gram counts

export const SKILL_BUCKETS: readonly SkillBucket[] = [
  'd0_15',
  'teens_fused',
  'twenties_fused',
  'tens_y',
  'tens_round',
  'hundreds_reg',
  'hundreds_irreg',
  'thousands',
  'millions',
  'decimals',
  'price_cents',
  'qty_fractions',
  'qty_grams',
];

/** Condensed groups used by the stats UI. */
export type DisplayGroup = 'small' | 'tens' | 'hundreds' | 'big' | 'prices' | 'weights';

export const DISPLAY_GROUPS: Record<DisplayGroup, readonly SkillBucket[]> = {
  small: ['d0_15', 'teens_fused', 'twenties_fused'],
  tens: ['tens_y', 'tens_round'],
  hundreds: ['hundreds_reg', 'hundreds_irreg'],
  big: ['thousands', 'millions'],
  prices: ['decimals', 'price_cents'],
  weights: ['qty_fractions', 'qty_grams'],
};

export const DISPLAY_GROUP_ORDER: readonly DisplayGroup[] = [
  'small',
  'tens',
  'hundreds',
  'big',
  'prices',
  'weights',
];

/** Inverse of DISPLAY_GROUPS: each bucket to its display group. */
export const BUCKET_TO_GROUP: Record<SkillBucket, DisplayGroup> = (() => {
  const map = {} as Record<SkillBucket, DisplayGroup>;
  for (const group of DISPLAY_GROUP_ORDER) {
    for (const bucket of DISPLAY_GROUPS[group]) {
      map[bucket] = group;
    }
  }
  return map;
})();

/* ------------------------------------------------------------------ *
 * Questions & answers
 * ------------------------------------------------------------------ */

export type PromptPayload =
  | { kind: 'number'; value: number }
  | { kind: 'price'; euros: number; cents: number }
  | { kind: 'quantity'; grams: number }
  /** `fracDigits` is a digit *string* — "05" and "5" are different readings. */
  | { kind: 'decimal'; intPart: number; fracDigits: string };

/**
 * Target for digit-typed answers ("type what you hear" modes). Mirrors the shape
 * of the engine's `parseDigitAnswer` result so grading is a direct comparison.
 */
export interface AcceptedDigits {
  intVal: number;
  /** Fractional digits after the comma ("50" for 2,50); omitted for whole numbers. */
  fracDigits?: string;
}

/** Either a spoken/written answer set (graded by the engine matcher) or digits. */
export type Accepted = AcceptedAnswer | AcceptedDigits;

/**
 * The {@link Accepted} discriminator. `intVal` is the only member unique to
 * {@link AcceptedDigits}, so it is what tells a digit target from a spoken one.
 */
export function isDigitTarget(accepted: Accepted): accepted is AcceptedDigits {
  return typeof (accepted as AcceptedDigits).intVal === 'number';
}

export interface Question {
  id: string;
  bucket: SkillBucket;
  prompt: PromptPayload;
  accepted: Accepted;
  fromWrongQueue?: boolean;
}

/* ------------------------------------------------------------------ *
 * Question shape guards
 * ------------------------------------------------------------------ *
 * Questions are the one part of the persisted state that is replayed as data
 * rather than merely displayed: a stored question is handed to the matcher, to
 * `expectedDisplayOf` and to a mode's zones, all of which read its fields
 * without checking them. Anything that reaches those from storage — a hand
 * edited slot, an imported bundle, a slot written by an older build — has to be
 * proved structurally sound first, so the guards below cover every field the
 * app dereferences.
 *
 * Structure is as far as they go. Whether a question's id *prefix* and its
 * payload kind belong together — a `choice:` id over a price tag is a question
 * no generator can mint — is not something this layer can say: which mode mints
 * which payload is knowledge of the modes layer, which this one may not import.
 * That half of the pairing is asserted by each mode's own
 * {@link QuestionSource.canReplay}, and a question its mode refuses never
 * reaches that mode's zones.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPromptPayload(value: unknown): value is PromptPayload {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case 'number':
      return Number.isFinite(value.value);
    case 'price':
      return Number.isFinite(value.euros) && Number.isFinite(value.cents);
    case 'quantity':
      return Number.isFinite(value.grams);
    case 'decimal':
      return Number.isFinite(value.intPart) && typeof value.fracDigits === 'string';
    default:
      return false;
  }
}

function isAnswerVariant(value: unknown): value is AnswerVariant {
  if (!isRecord(value)) return false;
  // `note` is a NoteKey, but an unknown one only renders as its own i18n key,
  // so the string test is all the safety the UI needs.
  return (
    typeof value.text === 'string' && (value.note === undefined || typeof value.note === 'string')
  );
}

function isAccepted(value: unknown): value is Accepted {
  if (!isRecord(value)) return false;
  // Same discriminator as isDigitTarget, so a value that passes here is graded
  // by exactly the branch this guard validated.
  if (typeof value.intVal === 'number') {
    return (
      Number.isFinite(value.intVal) &&
      (value.fracDigits === undefined || typeof value.fracDigits === 'string')
    );
  }
  return (
    typeof value.canonical === 'string' &&
    Array.isArray(value.variants) &&
    value.variants.every(isAnswerVariant)
  );
}

export function isQuestion(value: unknown): value is Question {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    (SKILL_BUCKETS as readonly unknown[]).includes(value.bucket) &&
    isPromptPayload(value.prompt) &&
    isAccepted(value.accepted) &&
    (value.fromWrongQueue === undefined || typeof value.fromWrongQueue === 'boolean')
  );
}

/**
 * Session verdict — deliberately the engine's own `VerdictKind`, so the mapping
 * from a match result stays the identity and cannot drift. `'almost'` (the engine
 * awards it for an accent-only miss) counts as correct everywhere but the score.
 * Fully accepted variants that carry a hint (crossUnit, colloquial, conAccepted)
 * stay `'correct'` and surface their `noteKey` to the UI.
 */
export type Verdict = VerdictKind;

export interface AnswerRecord {
  questionId: string;
  bucket: SkillBucket;
  given: string;
  verdict: Verdict;
  fromWrongQueue: boolean;
  noteKey?: NoteKey;
}

const VERDICTS: readonly Verdict[] = ['correct', 'almost', 'wrong'];

export function isAnswerRecord(value: unknown): value is AnswerRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.questionId === 'string' &&
    (SKILL_BUCKETS as readonly unknown[]).includes(value.bucket) &&
    typeof value.given === 'string' &&
    (VERDICTS as readonly unknown[]).includes(value.verdict) &&
    typeof value.fromWrongQueue === 'boolean' &&
    (value.noteKey === undefined || typeof value.noteKey === 'string')
  );
}

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

export interface Score {
  points: number;
  /** Consecutive non-wrong answers. 'almost' keeps the combo; 'wrong' resets to 0. */
  combo: number;
  bestCombo: number;
}

/* ------------------------------------------------------------------ *
 * SRS state (persisted plain JSON, versioned)
 * ------------------------------------------------------------------ */

export interface BucketStat {
  attempts: number;
  /** Correct incl. 'almost'. */
  correct: number;
  /** Ring of last 20 answers: true = non-wrong, false = wrong. */
  last20: boolean[];
}

export interface WrongQueueItem {
  question: Question;
  /** How many times this item has (re)entered the due schedule. */
  reappearances: number;
  /** Consecutive non-wrong answers of this exact item; leaves queue at 2. */
  consecutiveCorrect: number;
  /** Global answered-count at which this item becomes due again. */
  dueAt: number;
}

export interface SrsState {
  version: 1;
  /** Monotonic count of answered questions (drives wrongQueue due schedule). */
  answeredCount: number;
  buckets: Record<SkillBucket, BucketStat>;
  wrongQueue: WrongQueueItem[];
}

/* ------------------------------------------------------------------ *
 * Question source (implemented by the modes/ layer)
 * ------------------------------------------------------------------ */

export interface QuestionContext {
  /** SRS-weighted bucket the round suggests generating for. */
  suggestedBucket: SkillBucket;
  config: RoundConfig;
  /**
   * Ids of the questions served most recently (oldest first, a handful at
   * most). Derived from `served`, so it costs the serialized round nothing and
   * a resumed round rebuilds it exactly. A composite source reads it to avoid
   * repeating itself; every single-mode source ignores it.
   */
  recentQuestionIds: readonly string[];
  /**
   * The wrongQueue item due this step, when one is. The round replays queue items
   * verbatim and does not call `generate` for them, so this is set only by callers
   * that ask a source to re-derive a stored item (e.g. re-rendering a prompt for a
   * different mode). Sources may ignore it.
   */
  wrongQueueItem?: Question;
}

/**
 * Modes own question generation. The round asks the source which buckets are
 * eligible for the config, then requests a question for the suggested bucket.
 * Sources must be stateless and draw all randomness from the provided engine
 * `rng` — the round counts those draws to make resume deterministic.
 */
export interface QuestionSource {
  eligibleBuckets(config: RoundConfig): readonly SkillBucket[];
  generate(rng: Rng, ctx: QuestionContext): Question;
  /**
   * Whether this source can present and grade a question it did not generate
   * this round — a wrongQueue item or a question parked by an earlier session.
   *
   * The wrongQueue is global while `Question.accepted` belongs to the mode that
   * minted it: a `words` miss is graded against Spanish spellings and a `digits`
   * miss against an integer, so replaying one into the other marks a right
   * answer wrong, and an item only leaves the queue after two non-wrong answers.
   * Sources therefore claim only what they can actually serve; a source that
   * omits this accepts anything, which is what a single-mode test double wants.
   */
  canReplay?(question: Question): boolean;
}

/* ------------------------------------------------------------------ *
 * Rounds
 * ------------------------------------------------------------------ */

/** Any positive question count (retry rounds use the miss count) or endless. */
export type RoundSize = number | 'endless';

export interface RoundConfig {
  modeId: string;
  size: RoundSize;
  rangeMin: number;
  rangeMax: number;
  seed: number;
  /** Forgive accent-only misses with an 'almost' verdict. Defaults to true. */
  acceptNoAccents?: boolean;
}

export interface RoundState {
  config: RoundConfig;
  /** Number of rng draws consumed (for deterministic resume). */
  rngDraws: number;
  /** Questions served so far. */
  step: number;
  current: Question | null;
  served: Question[];
  records: AnswerRecord[];
  score: Score;
  /** Round-local step at which a wrongQueue item was last injected (≤1 per 3). */
  lastWrongQueueStep: number;
  finished: boolean;
  /** Retry rounds replay a fixed set of missed questions. */
  retry: boolean;
  retryItems: Question[];

  /* Runtime-only, not serialized — re-injected on resume: */
  srs: SrsState;
  source: QuestionSource;
  rng: CountingRng;
}

/**
 * A seeded engine {@link Rng} that counts how many values it has produced. Every
 * `Rng` method consumes exactly one underlying draw, so the count doubles as the
 * number of draws to skip when replaying the stream on resume.
 */
export interface CountingRng {
  rng: Rng;
  draws: () => number;
}

export interface RoundSummary {
  modeId: string;
  size: RoundSize;
  total: number;
  /** Correct incl. 'almost'. */
  correctCount: number;
  almostCount: number;
  wrongCount: number;
  accuracy: number;
  points: number;
  bestCombo: number;
  verdicts: AnswerRecord[];
  /** Wrong-verdict questions only — the retry source. */
  missed: Question[];
}

/**
 * Serialized round — the payload the storage layer parks in the `wordavi:round`
 * slot (`SavedRound.state`, typed `unknown` there so storage stays independent of
 * this layer). Plain JSON: no srs, source or rng, all of which are re-injected by
 * {@link deserializeRound}. `rngDraws` is what makes the resumed continuation
 * identical to the uninterrupted one.
 *
 * Versioned: bump `version` on any shape change and widen `isRoundSerialized`
 * accordingly — a slot that fails the guard is discarded, costing the learner
 * only an unfinished round.
 */
export interface RoundSerialized {
  version: 1;
  config: RoundConfig;
  rngDraws: number;
  step: number;
  served: Question[];
  records: AnswerRecord[];
  score: Score;
  lastWrongQueueStep: number;
  finished: boolean;
  retry: boolean;
  retryItems: Question[];
}

/* ------------------------------------------------------------------ *
 * Daily goal & streak
 * ------------------------------------------------------------------ */

export interface DayRowLike {
  date: string; // YYYY-MM-DD
  answered: number;
  correct: number; // correct incl. 'almost'
  byGroup: Record<string, { answered: number; correct: number }>;
}

export interface GoalVerdict {
  group: DisplayGroup;
  /** true when the answer counts toward the goal (correct or almost). */
  counted: boolean;
}

export interface StreakState {
  current: number;
  best: number;
  lastGoalDate: string | null; // YYYY-MM-DD
}
