/**
 * Shared engine contract. Both halves of the engine (numbers/normalize/match
 * here, and prices/quantities/generators/distractors alongside) compile against
 * these types, so keep them stable.
 */

/** Reason a non-`wrong` verdict carries, surfaced to the learner as a hint. */
export type NoteKey = 'accent' | 'crossUnit' | 'conAccepted' | 'colloquial';

/** One acceptable spelling of an answer, optionally flagged with a note. */
export interface AnswerVariant {
  text: string;
  note?: NoteKey;
}

/** The full accepted-answer set for a question; `canonical` is also a variant. */
export interface AcceptedAnswer {
  canonical: string;
  variants: AnswerVariant[];
}

/** Outcome of comparing a learner's answer against an {@link AcceptedAnswer}. */
export type VerdictKind = 'correct' | 'almost' | 'wrong';

/** Result of {@link matchText}: verdict plus the matched form and any note. */
export interface MatchResult {
  verdict: VerdictKind;
  matchedText?: string;
  noteKey?: NoteKey;
}

/** Matching knobs. `acceptNoAccents` decides if a missing accent is forgiven. */
export interface MatchOptions {
  acceptNoAccents: boolean;
}
