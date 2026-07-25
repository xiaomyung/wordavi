import type { PromptPayload, Question } from '@/session';

/**
 * Question id format, in one place.
 *
 * `"<modeId>:<suffix>"` — the mode that made the question, then whatever that
 * mode needs to identify it (`words:n475`, `grocery:p2.35`, `grocery:q1500`).
 * The prefix is load-bearing: the SRS and the wrongQueue key on the id, the
 * mixed mode reads it back to hand a replayed question to its origin mode, and
 * ids survive in storage across builds. Minting and parsing therefore live
 * together here, so the two can never drift apart.
 */

const SEPARATOR = ':';

/** Mint a stable id: same mode + same suffix = same SRS / wrongQueue item. */
export function questionId(modeId: string, suffix: string): string {
  return `${modeId}${SEPARATOR}${suffix}`;
}

/**
 * The mode id an existing question id was minted with (`words:n475` → `words`),
 * or `''` for a string that carries no prefix at all.
 */
export function modeIdOf(id: string): string {
  const separator = id.indexOf(SEPARATOR);
  return separator === -1 ? '' : id.slice(0, separator);
}

/**
 * Whether `question` is `modeId`'s own: the id prefix has to be this mode's AND
 * the payload has to be one of the `kinds` this mode mints. That pairing is the
 * whole point — a mode's generator produces one shape and its zones read exactly
 * that shape, so the two halves of the invariant are what make a question
 * presentable, not just gradable.
 *
 * Both are checked because questions outlive the run that minted them: they are
 * replayed from storage as data (a wrongQueue item, a parked round), and the
 * shape guard on the way in proves each field well-formed without pairing the id
 * against the payload. A slot that carries one mode's prefix over a payload it
 * never mints — an edited export, a half-written slot — would otherwise reach a
 * zone with nothing to draw from it.
 */
export function ownsQuestion(
  question: Question,
  modeId: string,
  kinds: readonly PromptPayload['kind'][],
): boolean {
  return modeIdOf(question.id) === modeId && kinds.includes(question.prompt.kind);
}
