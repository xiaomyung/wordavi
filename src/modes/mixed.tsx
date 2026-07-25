import { type Question, SKILL_BUCKETS, type SkillBucket } from '@/session';
import { choiceMode } from './choice';
import { digitsMode } from './digits';
import { groceryMode } from './grocery';
import { listenMode } from './listen';
import { modeIdOf } from './questionId';
import { speakMode } from './speak';
import type { AnswerZoneProps, LearningMode, ModeId, PromptProps } from './types';
import { MIXED_MODE_ID } from './types';
import { wordsMode } from './words';

/**
 * mixed — the home screen's big button: one round drawn from every mode.
 *
 * ## What makes it a mode rather than a round option
 *
 * The drill resolves a mode by id and asks it for questions and zones; making
 * "mixed" one of those modes means the round, the SRS, the parked-round slot,
 * the retry path and the summary all keep working unchanged. Nothing new is
 * serialized: every question keeps the id its *origin* mode gave it
 * (`words:n475`, `grocery:p2.35`, …), so {@link modeOfQuestion} can hand a
 * replayed or resumed question back to the mode that made it.
 *
 * ## Availability
 *
 * A mode the browser cannot serve (no Spanish voice, no microphone, offline)
 * is dashed out on home, and must not turn up inside a mixed round either.
 * Only the app layer may ask the services about that, and the modes layer may
 * not import them — so the screens push the answer in with
 * {@link setMixedAvailability} at round start. Until they do, every mode is
 * fair game (the honest default for a build with no capability probes at all).
 *
 * ## Anti-streak
 *
 * A uniform draw over six modes still clumps ("three by ear in a row" reads as
 * broken shuffling). Candidates that appear in the last
 * {@link ANTI_STREAK_WINDOW} question ids are dropped whenever something else
 * is available, which keeps the mix visibly shuffled without ever leaving the
 * round unable to produce a question.
 */

/** Every mode a mixed round can draw from, in {@link MODE_ORDER} order. */
const SINGLE_MODES: readonly LearningMode[] = [
  wordsMode,
  digitsMode,
  listenMode,
  choiceMode,
  speakMode,
  groceryMode,
];

/** How far back the anti-streak rule looks when excluding candidates. */
const ANTI_STREAK_WINDOW = 2;

/** Origin mode of a question whose id carries no known prefix. */
const FALLBACK_MODE = wordsMode;

/* ------------------------------------------------------------------ *
 * Availability (pushed in by the screens at round start)
 * ------------------------------------------------------------------ */

let availability: readonly ModeId[] | null = null;

/**
 * Restrict a mixed round to the modes the browser can actually serve right now.
 * Pass `null` to restore the default (every mode). Set once per round, before
 * the first question is generated; a resumed round re-samples it, so a round
 * parked online does not keep serving voice questions offline.
 */
export function setMixedAvailability(ids: readonly ModeId[] | null): void {
  availability = ids === null ? null : [...ids];
}

/** The modes a mixed round may draw from; never empty. */
function availableModes(): readonly LearningMode[] {
  if (availability === null) return SINGLE_MODES;
  const allowed = new Set<ModeId>(availability);
  const modes = SINGLE_MODES.filter((mode) => allowed.has(mode.id));
  // An empty (or unrecognisable) filter would leave the round with nothing to
  // ask; a full mix beats a dead drill.
  return modes.length > 0 ? modes : SINGLE_MODES;
}

/* ------------------------------------------------------------------ *
 * Question → its origin mode
 * ------------------------------------------------------------------ */

/** The mode whose prefix the id carries, or undefined when no mode claims it. */
function originMode(question: Question): LearningMode | undefined {
  const id = modeIdOf(question.id);
  return SINGLE_MODES.find((mode) => mode.id === id);
}

/**
 * The mode a question came from. Falls back to `words` for an id no mode
 * claims — a question from an older build still has to be answerable.
 */
export function modeOfQuestion(question: Question): LearningMode {
  return originMode(question) ?? FALLBACK_MODE;
}

/* ------------------------------------------------------------------ *
 * Zones — the origin mode's own, with the props it would have received
 * ------------------------------------------------------------------ */

function MixedPrompt(props: PromptProps) {
  const Prompt = modeOfQuestion(props.question).Prompt;
  return <Prompt {...props} />;
}

function MixedAnswerZone(props: AnswerZoneProps) {
  const AnswerZone = modeOfQuestion(props.question).AnswerZone;
  return <AnswerZone {...props} />;
}

/* ------------------------------------------------------------------ *
 * Mode
 * ------------------------------------------------------------------ */

/** Every label key any mode may ask for — the drill prepares them all. */
const LABEL_KEYS: readonly string[] = [
  ...new Set(SINGLE_MODES.flatMap((mode) => [...mode.labelKeys])),
];

export const mixedMode: LearningMode = {
  id: MIXED_MODE_ID,
  titleKey: 'modes.mixed.title',
  exampleKey: 'modes.mixed.sub',
  // Individual modes are filtered by capability; the mix itself always runs.
  requires: [],
  labelKeys: LABEL_KEYS,
  source: {
    eligibleBuckets(config): readonly SkillBucket[] {
      const union = new Set<SkillBucket>();
      for (const mode of availableModes()) {
        for (const bucket of mode.source.eligibleBuckets(config)) union.add(bucket);
      }
      // Ordered by the canonical bucket list so the round sees a stable,
      // duplicate-free set whatever the availability filter was.
      return SKILL_BUCKETS.filter((bucket) => union.has(bucket));
    },
    generate(rng, ctx): Question {
      const modes = availableModes();
      const forBucket = modes.filter((mode) =>
        mode.source.eligibleBuckets(ctx.config).includes(ctx.suggestedBucket),
      );
      // No mode teaches the suggested bucket (an availability filter can do
      // that): any mode is better than no question.
      const candidates = forBucket.length > 0 ? forBucket : modes;

      const recent = new Set(
        ctx.recentQuestionIds.slice(-ANTI_STREAK_WINDOW).map((id) => modeIdOf(id)),
      );
      const fresh = candidates.filter((mode) => !recent.has(mode.id));
      const pool = fresh.length > 0 ? fresh : candidates;

      // Exactly one draw here plus whatever the delegate takes, all from the
      // round's counting rng — resume stays deterministic.
      return rng.pick(pool).source.generate(rng, ctx);
    },
    /**
     * A mixed round hands every question to its origin mode, so it can replay
     * anything that mode can: bounded by the same availability filter that
     * bounds generation (a round running without a microphone does not re-serve
     * a spoken miss), and by the origin's own claim, which is what keeps a
     * payload its zones cannot draw out of the mix. An id no mode claims has no
     * owner to ask and is drawn by the fallback mode, which reads any payload.
     */
    canReplay(question): boolean {
      const origin = originMode(question);
      if (origin === undefined) return availableModes().includes(FALLBACK_MODE);
      return availableModes().includes(origin) && (origin.source.canReplay?.(question) ?? true);
    },
  },
  pickGiven(alternatives, question) {
    const mode = modeOfQuestion(question);
    return mode.pickGiven?.(alternatives, question) ?? alternatives[0] ?? '';
  },
  titleKeyFor(question) {
    return modeOfQuestion(question).titleKey;
  },
  Prompt: MixedPrompt,
  AnswerZone: MixedAnswerZone,
};
