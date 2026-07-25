/**
 * Public API of the pure `engine` layer.
 *
 * The engine imports nothing app-side (no react, no other layers) — see the
 * layer contract enforced by tests/architecture.test.ts. Additional engine
 * modules (prices, quantities, generators, distractors, rng, format) re-export
 * through this barrel alongside the number/normalise/match core below.
 */

export { buildAccepted, decimalToWords, fracDigitsToWords } from './decimals';
export { buildDistractors, confusablesOf, shuffle } from './distractors';
export {
  type DigitAnswer,
  type FormattedWeight,
  formatNumber,
  formatPrice,
  formatWeight,
  parseDigitAnswer,
  THIN_SPACE,
} from './format';
export {
  type GeneratedPrice,
  generateNumber,
  generatePrice,
  generateQuantity,
  type NumberRange,
} from './generators';
export { matchText } from './match';
export { hasAccentDifference, normalizeAnswer, stripAccents } from './normalize';
export { NUMBER_MAX, numberToWords, wordsWithApocope } from './numbers';
export { priceToWords } from './prices';
export { type Quantity, quantityToWords } from './quantities';
export { createRng, type Rng } from './rng';
export type {
  AcceptedAnswer,
  AnswerVariant,
  MatchOptions,
  MatchResult,
  NoteKey,
  VerdictKind,
} from './types';
