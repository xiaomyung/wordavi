import { buildAccepted, fracDigitsToWords } from './decimals';
import { numberToWords } from './numbers';
import type { AcceptedAnswer, AnswerVariant } from './types';

/** A weight to be spoken, held in grams (the lossless internal unit). */
export type Quantity = { kind: 'weight'; grams: number };

/** "un kilo" / "dos kilos" — apocope on the singular. */
function kilosPhrase(kg: number): string {
  return kg === 1 ? 'un kilo' : `${numberToWords(kg)} kilos`;
}

/** "un kilogramo" / "dos kilogramos" — the full-word synonym, never noted. */
function kilogramosPhrase(kg: number): string {
  return kg === 1 ? 'un kilogramo' : `${numberToWords(kg)} kilogramos`;
}

/** "trescientos gramos". */
function gramos(grams: number): string {
  return `${numberToWords(grams)} gramos`;
}

/** Decimal-kg reading of a weight, e.g. 1200 g → "uno coma dos". */
function decimalKgWords(grams: number): string {
  const kg = Math.floor(grams / 1000);
  const remainder = grams % 1000;
  const fracDigits = String(remainder).padStart(3, '0').replace(/0+$/, '');
  return `${numberToWords(kg)} coma ${fracDigitsToWords(fracDigits)}`;
}

/**
 * Accepted spoken forms of a grocery weight. Canonical forms follow how a
 * Spanish shopper says them; cross-unit equivalents (grams for a kg amount,
 * or vice versa) are accepted with a `crossUnit` note. "kilo"/"kilogramo" are
 * interchangeable and the "kilogramo" spelling never carries a note.
 */
export function quantityToWords(q: Quantity): AcceptedAnswer {
  const g = q.grams;

  // Named fractions of a kilo.
  if (g === 500) {
    return buildAccepted('medio kilo', [
      { text: 'quinientos gramos', note: 'crossUnit' },
      { text: 'medio kilogramo' },
    ]);
  }
  if (g === 250) {
    return buildAccepted('cuarto de kilo', [
      { text: 'un cuarto de kilo' },
      { text: 'doscientos cincuenta gramos', note: 'crossUnit' },
      { text: 'cuarto de kilogramo' },
    ]);
  }
  if (g === 750) {
    return buildAccepted('tres cuartos de kilo', [
      { text: 'setecientos cincuenta gramos', note: 'crossUnit' },
      { text: 'tres cuartos de kilogramo' },
    ]);
  }
  if (g === 1500) {
    return buildAccepted('kilo y medio', [
      { text: 'un kilo y medio' },
      { text: 'mil quinientos gramos', note: 'crossUnit' },
      { text: 'uno coma cinco kilos', note: 'crossUnit' },
      { text: 'kilogramo y medio' },
    ]);
  }

  // Whole kilos.
  if (g % 1000 === 0) {
    const kg = g / 1000;
    return buildAccepted(kilosPhrase(kg), [
      { text: kilogramosPhrase(kg) },
      { text: gramos(g), note: 'crossUnit' },
    ]);
  }

  // Whole kilos plus a half (2500, 3500, …) — 1500 handled above.
  if (g % 1000 === 500) {
    const kg = Math.floor(g / 1000);
    return buildAccepted(`${kilosPhrase(kg)} y medio`, [
      { text: `${kilogramosPhrase(kg)} y medio` },
      { text: gramos(g), note: 'crossUnit' },
      { text: `${decimalKgWords(g)} kilos`, note: 'crossUnit' },
    ]);
  }

  // Sub-kilo amounts that are not a named fraction → plain grams.
  if (g < 1000) {
    return buildAccepted(gramos(g), []);
  }

  // Other decimal kilos (1200, 1800, 2200, …): the "1,2 kg" reading is
  // canonical (mirrors the display), grams and "kilo doscientos" are variants.
  const kg = Math.floor(g / 1000);
  const remainder = g % 1000;
  const variants: AnswerVariant[] = [
    { text: gramos(g), note: 'crossUnit' },
    { text: `${kilosPhrase(kg)} ${numberToWords(remainder)}`, note: 'colloquial' },
  ];
  return buildAccepted(`${decimalKgWords(g)} kilos`, variants);
}
