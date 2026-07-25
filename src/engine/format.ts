/**
 * Pure display formatting for the es-ES locale: thin-space (U+2009) thousands
 * grouping, comma decimal separator, and a tolerant digit-answer parser.
 *
 * Unit *labels* (kg/g, €) are localised by the UI; the engine only shapes the
 * numeric value and, for currency, appends the € sign the price question owns.
 */
import { GRAMS_PER_KILO } from './quantities';

/**
 * U+2009 THIN SPACE — the es-ES thousands separator used across the app, and
 * the separator a caller must put before a unit ("250 g") to match what these
 * formatters emit. Exported so no caller has to re-type the invisible glyph.
 */
export const THIN_SPACE = ' ';

/** Insert a thin space between every group of three integer digits. */
function groupThousands(intDigits: string): string {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE);
}

/**
 * Format a number for display: thin-space thousands grouping and a comma
 * decimal separator. 1234567 → "1 234 567"; 1234.5 → "1 234,5".
 */
export function formatNumber(n: number): string {
  const negative = n < 0;
  const parts = String(Math.abs(n)).split('.');
  const intPart = parts[0] ?? '0';
  const fracPart = parts[1];
  const grouped = groupThousands(intPart);
  const body = fracPart ? `${grouped},${fracPart}` : grouped;
  return negative ? `-${body}` : body;
}

/**
 * Format a EUR price: comma decimal, two cent digits, thin space before €.
 * (1234, 5) → "1 234,05 €".
 */
export function formatPrice(euros: number, cents: number): string {
  return `${formatNumber(euros)},${String(cents).padStart(2, '0')}${THIN_SPACE}€`;
}

/** A formatted weight value plus the unit the UI should label it with. */
export interface FormattedWeight {
  value: string;
  unit: 'kg' | 'g';
}

/**
 * Format a weight for display. Under a kilo it shows grams; from a kilo up it
 * shows kilograms with a comma decimal and trailing zeros stripped
 * (1500 → "1,5" kg, 2000 → "2" kg, 250 → "250" g). The UI adds the localised
 * unit label.
 */
export function formatWeight(grams: number): FormattedWeight {
  if (grams < GRAMS_PER_KILO) {
    return { value: formatNumber(grams), unit: 'g' };
  }
  const kg = grams / GRAMS_PER_KILO;
  const trimmed = kg.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  const parts = trimmed.split('.');
  const intPart = parts[0] ?? '0';
  const fracPart = parts[1];
  const grouped = groupThousands(intPart);
  return { value: fracPart ? `${grouped},${fracPart}` : grouped, unit: 'kg' };
}

/** A parsed digit answer: an integer, optionally with fractional digits. */
export type DigitAnswer = { intVal: number } | { intVal: number; fracDigits: string };

/**
 * Parse a typed numeric answer under es-ES conventions:
 *   - spaces (incl. thin/nbsp, matched by \s) and dots are thousands grouping,
 *   - a single comma is the decimal separator,
 *   - anything else (letters, extra commas, empty) is rejected as `null`.
 *
 * "1 500" → {1500}; "1.500" → {1500}; "2,35" → {2, "35"};
 * "1.500,50" → {1500, "50"}; "abc" → null.
 */
export function parseDigitAnswer(input: string): DigitAnswer | null {
  const cleaned = input.replace(/[\s.]/g, '');
  if (!/^\d*(,\d+)?$/.test(cleaned) || !/\d/.test(cleaned)) return null;
  const commaIndex = cleaned.indexOf(',');
  if (commaIndex === -1) {
    return { intVal: Number(cleaned) };
  }
  const intStr = cleaned.slice(0, commaIndex);
  const fracDigits = cleaned.slice(commaIndex + 1);
  return { intVal: intStr === '' ? 0 : Number(intStr), fracDigits };
}
