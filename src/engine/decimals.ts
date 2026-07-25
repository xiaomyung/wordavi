import { numberToWords } from './numbers';
import type { AcceptedAnswer, AnswerVariant } from './types';

/**
 * Assemble an {@link AcceptedAnswer} whose `variants` list *includes* the
 * canonical form as its first, note-free entry — the matcher (match.ts) only
 * ever compares against `variants`, so the canonical must live there to be
 * accepted. Later duplicates are dropped, preserving order and notes.
 * Shared by prices/quantities so every accepted set is built the same way.
 */
export function buildAccepted(canonical: string, variants: AnswerVariant[]): AcceptedAnswer {
  const seen = new Set<string>();
  const out: AnswerVariant[] = [];
  for (const variant of [{ text: canonical }, ...variants]) {
    if (seen.has(variant.text)) continue;
    seen.add(variant.text);
    out.push(variant);
  }
  return { canonical, variants: out };
}

/**
 * Spoken form of a fractional-digit string (the part after the comma).
 *
 * es-ES reads short fractions as a single number and long ones digit-by-digit:
 *   - 1 digit            → the number        ("5"  → "cinco")
 *   - 2 digits, no lead 0 → the number        ("45" → "cuarenta y cinco")
 *   - 2 digits, leading 0 → digit-by-digit    ("05" → "cero cinco")  [keeps the 0 audible]
 *   - 3+ digits          → digit-by-digit    ("456" → "cuatro cinco seis")
 *
 * The leading-zero case deviates from the plain "1-2 digits as a number" rule
 * on purpose: "cero cinco" is unambiguous where "cinco" would drop the zero.
 */
export function fracDigitsToWords(fracDigits: string): string {
  const asNumber = fracDigits.length === 1 || (fracDigits.length === 2 && fracDigits[0] !== '0');
  if (asNumber) return numberToWords(Number(fracDigits));
  return fracDigits
    .split('')
    .map((digit) => numberToWords(Number(digit)))
    .join(' ');
}

/**
 * Accepted spoken forms of a decimal number, e.g. (3, "5") → 3,5.
 *
 * Canonical uses "coma" (the es-ES decimal word); "con" is accepted with a
 * {@link AnswerVariant.note} of `conAccepted`. The fractional part follows
 * {@link fracDigitsToWords}: "3,45" → "tres coma cuarenta y cinco".
 */
export function decimalToWords(intPart: number, fracDigits: string): AcceptedAnswer {
  const intWords = numberToWords(intPart);
  const fracWords = fracDigitsToWords(fracDigits);
  return buildAccepted(`${intWords} coma ${fracWords}`, [
    { text: `${intWords} con ${fracWords}`, note: 'conAccepted' },
  ]);
}
