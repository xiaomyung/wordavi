/**
 * Forgiving answer matching (see adr-013 and spanish-number-rules).
 *
 * A learner's typed answer is compared against an {@link AcceptedAnswer}'s
 * variant set in two passes:
 *   1. accent-sensitive exact match → `correct` (carrying the variant's note,
 *      if any, so the UI can show a hint about an accepted-but-imperfect form);
 *   2. accent-insensitive match → `almost` with an `accent` note when
 *      `acceptNoAccents` is on, otherwise `wrong` (strict mode).
 *
 * Anything else is `wrong`. Grammatical errors (archaic "veinte y uno", a stray
 * "y", "un mil") simply never appear in a variant set, so they fall through to
 * `wrong` — they are not spelling slips to forgive.
 */

import { normalizeAnswer, stripAccents } from './normalize';
import type { AcceptedAnswer, MatchOptions, MatchResult } from './types';

/** Compare `given` against `accepted`, applying {@link MatchOptions}. */
export function matchText(
  accepted: AcceptedAnswer,
  given: string,
  opts: MatchOptions,
): MatchResult {
  const normGiven = normalizeAnswer(given);

  // Pass 1: accent-sensitive exact match against any variant.
  for (const variant of accepted.variants) {
    if (normalizeAnswer(variant.text) === normGiven) {
      return variant.note !== undefined
        ? { verdict: 'correct', matchedText: variant.text, noteKey: variant.note }
        : { verdict: 'correct', matchedText: variant.text };
    }
  }

  // Pass 2: accent-insensitive match.
  const foldedGiven = stripAccents(normGiven);
  for (const variant of accepted.variants) {
    if (stripAccents(normalizeAnswer(variant.text)) === foldedGiven) {
      if (opts.acceptNoAccents) {
        return { verdict: 'almost', matchedText: accepted.canonical, noteKey: 'accent' };
      }
      return { verdict: 'wrong' };
    }
  }

  return { verdict: 'wrong' };
}
