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
