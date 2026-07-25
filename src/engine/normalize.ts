/**
 * Answer normalisation for forgiving matching.
 *
 * Two levels of comparison are needed (see spanish-number-rules):
 *   - {@link normalizeAnswer} keeps accents, so an exact accent-sensitive
 *     comparison can tell "dieciséis" from "dieciseis".
 *   - {@link stripAccents} folds diacritics for the accent-insensitive pass,
 *     while preserving ñ as a distinct letter (it is NOT an accented n).
 */

// Combining diacritical marks left behind after NFD decomposition (U+0300..U+036F).
const COMBINING_MARKS = /[\u0300-\u036f]/g;
// n/N + combining tilde (U+0303): the decomposed ñ/Ñ, which stays a letter.
const N_WITH_TILDE = /([nN])\u0303/g;
// Punctuation / symbols to shave off the ends of a typed answer.
const EDGE_NOISE = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu;

/**
 * Canonicalise a typed answer for accent-*sensitive* comparison: compose to
 * NFC (so precomposed and decomposed accents compare equal), lowercase,
 * collapse internal whitespace, trim, and strip leading/trailing punctuation.
 * Accents and ñ are preserved: "año" stays distinct from "ano".
 */
export function normalizeAnswer(s: string): string {
  let out = s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
  // Stripping edge noise can expose new edge noise ("{ !0" -> "!0"), so
  // repeat until stable to keep normalization idempotent.
  for (;;) {
    const next = out.replace(EDGE_NOISE, '').trim();
    if (next === out) return out;
    out = next;
  }
}

/**
 * Fold diacritics for accent-insensitive comparison: strip vowel accents but
 * keep ñ/Ñ intact ("año" stays "año", never "ano"). Case and spacing are
 * left as given, so callers typically pass an already-normalized string.
 */
export function stripAccents(s: string): string {
  return s
    .normalize('NFD')
    .replace(N_WITH_TILDE, (_match, letter: string) => (letter === 'N' ? 'Ñ' : 'ñ'))
    .replace(COMBINING_MARKS, '');
}

/**
 * True when two answers differ only by accents: equal after accent-folding but
 * not before (both compared through {@link normalizeAnswer} first).
 */
export function hasAccentDifference(a: string, b: string): boolean {
  const na = normalizeAnswer(a);
  const nb = normalizeAnswer(b);
  if (na === nb) return false;
  return stripAccents(na) === stripAccents(nb);
}
