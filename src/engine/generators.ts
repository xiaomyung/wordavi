import { GRAMS_PER_KILO, type Quantity } from './quantities';
import type { Rng } from './rng';

/** Inclusive [min, max] bound for number generation. */
export interface NumberRange {
  min: number;
  max: number;
}

/** A generated price, split into whole euros and cents (0-99). */
export interface GeneratedPrice {
  euros: number;
  cents: number;
}

/**
 * Digit-length bands overlapping [min, max]: band d covers [10^(d-1), 10^d − 1]
 * (band 1 starts at 0), each clipped to the range. Empty bands are dropped.
 */
function digitBands(min: number, max: number): Array<[number, number]> {
  const bands: Array<[number, number]> = [];
  const maxDigits = String(Math.max(0, max)).length;
  for (let d = 1; d <= maxDigits; d++) {
    const low = d === 1 ? 0 : 10 ** (d - 1);
    const high = 10 ** d - 1;
    const lo = Math.max(low, min);
    const hi = Math.min(high, max);
    if (lo <= hi) bands.push([lo, hi]);
  }
  return bands;
}

/**
 * Generate a number in [min, max], balanced by digit length: pick a digit-count
 * band uniformly among those overlapping the range, then a value uniformly in
 * that band. This stops 6-digit values dominating a 0..1,000,000 range (uniform
 * sampling there would draw a 6-digit number ~90% of the time).
 */
export function generateNumber(rng: Rng, range: NumberRange): number {
  const { min, max } = range;
  if (min >= max) return min;
  const bands = digitBands(min, max);
  const band = rng.pick(bands);
  return rng.int(band[0], band[1]);
}

// Magnitude of a price: heavy on the everyday 1–20 € range.
const PRICE_MAGNITUDES: ReadonlyArray<readonly [string, number]> = [
  ['sub1', 10],
  ['1to5', 35],
  ['5to20', 35],
  ['20to100', 15],
  ['100to1000', 5],
];

// Cent endings weighted toward the ones shops actually use.
const CENT_WEIGHTS = new Map<number, number>([
  [99, 4],
  [95, 3],
  [50, 3],
  [0, 3],
  [25, 2],
  [75, 2],
  [49, 2],
  [90, 2],
]);

function centItems(includeZero: boolean): Array<[number, number]> {
  const items: Array<[number, number]> = [];
  for (let c = includeZero ? 0 : 1; c <= 99; c++) {
    items.push([c, CENT_WEIGHTS.get(c) ?? 1]);
  }
  return items;
}

const CENTS_WITH_ZERO = centItems(true);
const CENTS_NO_ZERO = centItems(false);

/**
 * Generate a realistic grocery price. Magnitude is weighted toward 1–20 €
 * (<1 € 10%, 1–5 € 35%, 5–20 € 35%, 20–100 € 15%, 100–1000 € 5%); cent endings
 * are weighted toward ,99/,95/,50/,00/… Sub-euro prices never come out as ,00.
 */
export function generatePrice(rng: Rng): GeneratedPrice {
  const magnitude = rng.weighted(PRICE_MAGNITUDES);
  let euros: number;
  switch (magnitude) {
    case 'sub1':
      euros = 0;
      break;
    case '1to5':
      euros = rng.int(1, 4);
      break;
    case '5to20':
      euros = rng.int(5, 19);
      break;
    case '20to100':
      euros = rng.int(20, 99);
      break;
    default:
      euros = rng.int(100, 999);
      break;
  }
  const cents = rng.weighted(euros === 0 ? CENTS_NO_ZERO : CENTS_WITH_ZERO);
  return { euros, cents };
}

// Sub-kilo gram amounts a shopper reads off a scale.
const GRAM_VALUES: readonly number[] = [50, 100, 150, 200, 250, 300, 400, 600, 750, 800];
// Non-round decimal kilos (1500 lives in its own named-fraction category).
const DECIMAL_KG_GRAMS: readonly number[] = [1200, 1800, 2200, 2500, 3500];

/**
 * Generate a grocery weight, mixing named fractions (medio/cuarto/tres cuartos/
 * kilo y medio), 1–5 whole kilos, sub-kilo gram amounts, and decimal kilos.
 */
export function generateQuantity(rng: Rng): Quantity {
  const kind = rng.weighted<string>([
    ['medio', 2],
    ['cuarto', 2],
    ['tresCuartos', 2],
    ['kiloYMedio', 2],
    ['wholeKg', 3],
    ['grams', 3],
    ['decimalKg', 2],
  ]);
  let grams: number;
  switch (kind) {
    case 'medio':
      grams = 500;
      break;
    case 'cuarto':
      grams = 250;
      break;
    case 'tresCuartos':
      grams = 750;
      break;
    case 'kiloYMedio':
      grams = 1500;
      break;
    case 'wholeKg':
      grams = rng.int(1, 5) * GRAMS_PER_KILO;
      break;
    case 'grams':
      grams = rng.pick(GRAM_VALUES);
      break;
    default:
      grams = rng.pick(DECIMAL_KG_GRAMS);
      break;
  }
  return { kind: 'weight', grams };
}
