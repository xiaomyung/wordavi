import { buildAccepted } from './decimals';
import { numberToWords, wordsWithApocope } from './numbers';
import type { AcceptedAnswer, AnswerVariant } from './types';

/**
 * es-ES cashier phrasings for a EUR price. See the design notes at the bottom
 * for what is canonical vs. an accepted variant and why each note is applied.
 *
 * The "euros"/"céntimos" noun triggers apocope ("un euro", "veintiún euros",
 * "un céntimo"); the bare number that stands in for a dropped noun does not
 * ("uno con cincuenta", "veintiuno con cincuenta"). Euros are masculine, so
 * the feminine "veintiuna" is never produced.
 */

/** "un euro" / "cuatro euros" / "veintiún euros" — noun-adjacent, apocopated. */
function eurosNoun(euros: number): string {
  return euros === 1 ? 'un euro' : `${wordsWithApocope(euros)} euros`;
}

/** "un céntimo" / "setenta y cinco céntimos" / "veintiún céntimos". */
function centimosNoun(cents: number): string {
  return cents === 1 ? 'un céntimo' : `${wordsWithApocope(cents)} céntimos`;
}

/** Bare euro count standing in for the dropped noun: full, non-apocopated. */
function bareEuros(euros: number): string {
  return numberToWords(euros);
}

/**
 * Cents in a "con"/"coma" reading. Single-digit cents keep an audible "cero"
 * ("cuatro con cero cinco" = 4,05) so they are not misheard as tenths.
 */
function bareCents(cents: number): string {
  return cents < 10 ? `cero ${numberToWords(cents)}` : numberToWords(cents);
}

/**
 * Accepted spoken forms of a price `euros,cents` €.
 *
 * @param euros whole-euro part (>= 0)
 * @param cents cent part (0-99)
 */
export function priceToWords(euros: number, cents: number): AcceptedAnswer {
  // Exact euros — no cents spoken.
  if (cents === 0) {
    return buildAccepted(eurosNoun(euros), [{ text: bareEuros(euros), note: 'colloquial' }]);
  }

  // Under one euro — céntimos lead, the "0,xx" number reading is colloquial.
  if (euros === 0) {
    return buildAccepted(centimosNoun(cents), [
      { text: `cero con ${bareCents(cents)}`, note: 'colloquial' },
      { text: `cero coma ${bareCents(cents)}`, note: 'colloquial' },
    ]);
  }

  // General case: euros + cents.
  const variants: AnswerVariant[] = [
    { text: `${eurosNoun(euros)} con ${bareCents(cents)}` },
    { text: `${eurosNoun(euros)} y ${centimosNoun(cents)}` },
    { text: `${eurosNoun(euros)} con ${centimosNoun(cents)}` },
    { text: `${eurosNoun(euros)} ${centimosNoun(cents)}` },
    { text: `${bareEuros(euros)} coma ${bareCents(cents)}`, note: 'colloquial' },
  ];
  // "cuatro euros setenta y cinco" / "cuatro setenta y cinco" only read cleanly
  // when cents are two digits; single-digit cents would sound like tenths.
  if (cents >= 10) {
    variants.push({ text: `${eurosNoun(euros)} ${bareCents(cents)}` });
    variants.push({ text: `${bareEuros(euros)} ${bareCents(cents)}`, note: 'colloquial' });
  }

  return buildAccepted(`${bareEuros(euros)} con ${bareCents(cents)}`, variants);
}
