/**
 * Canonical es-ES (peninsular Spanish) spelling of integers.
 *
 * The rules are the single source of truth in
 * docs/architecture/spanish-number-rules.md. Highlights encoded here:
 *   - 16–29 are fused single words (dieciséis … veintinueve); the archaic
 *     three-word forms are NOT produced (and are hard-rejected by the matcher).
 *   - "y" joins ONLY a tens word (30–90) and a unit (1–9): treinta y uno.
 *   - 100 = cien; 101–199 = ciento …; irregular hundreds quinientos/setecientos/
 *     novecientos.
 *   - mil is never "un mil"; un millón is countable; long scale (10⁹ = mil
 *     millones, never "billón").
 *   - Apocope uno → un / veintiuno → veintiún before mil, millones, and
 *     masculine nouns, via {@link wordsWithApocope}.
 *
 * Numbers are spelled in the masculine (uno, doscientos), matching euros and
 * grocery units. Range: 0 … 999_999_999_999 inclusive; anything else throws.
 */

/** Largest integer this module can spell. Anything above it throws. */
export const NUMBER_MAX = 999_999_999_999;
const MAX = NUMBER_MAX;
const MILLION = 1_000_000;
const THOUSAND = 1_000;

/** cero … veintinueve. Indices 16–29 are fused single words (four accented). */
const WORDS_0_29 = [
  'cero',
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'veintiuno',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
] as const;

/** Tens words keyed by the tens digit 3–9 (30 … 90). */
const TENS: Readonly<Record<number, string>> = {
  3: 'treinta',
  4: 'cuarenta',
  5: 'cincuenta',
  6: 'sesenta',
  7: 'setenta',
  8: 'ochenta',
  9: 'noventa',
};

/**
 * Hundreds prefixes keyed by the hundreds digit 1–9. `ciento` is the 101–199
 * form; exactly 100 is the special word `cien`, handled in {@link belowThousand}.
 * 500/700/900 are the irregulars quinientos/setecientos/novecientos.
 */
const HUNDREDS: Readonly<Record<number, string>> = {
  1: 'ciento',
  2: 'doscientos',
  3: 'trescientos',
  4: 'cuatrocientos',
  5: 'quinientos',
  6: 'seiscientos',
  7: 'setecientos',
  8: 'ochocientos',
  9: 'novecientos',
};

/** Spell 1–99. Fused for 1–29; "tens y units" for 31–99. */
function belowHundred(n: number): string {
  const fused = WORDS_0_29[n];
  if (fused !== undefined) return fused;
  const tens = Math.floor(n / 10);
  const unit = n % 10;
  const tensWord = TENS[tens] as string;
  if (unit === 0) return tensWord;
  return `${tensWord} y ${WORDS_0_29[unit] as string}`;
}

/** Spell 1–999. No "y" after the hundreds; exactly 100 is `cien`. */
function belowThousand(n: number): string {
  if (n === 100) return 'cien';
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) parts.push(HUNDREDS[hundreds] as string);
  if (rest > 0) parts.push(belowHundred(rest));
  return parts.join(' ');
}

/** Spell 1–999_999. `mil` is bare (never "un mil"); apocope before `mil`. */
function belowMillion(n: number): string {
  const thousands = Math.floor(n / THOUSAND);
  const rest = n % THOUSAND;
  const parts: string[] = [];
  if (thousands === 1) {
    parts.push('mil');
  } else if (thousands > 1) {
    parts.push(`${wordsWithApocope(thousands)} mil`);
  }
  if (rest > 0) parts.push(belowThousand(rest));
  return parts.join(' ');
}

/**
 * Canonical spelling of an integer 0 … 999_999_999_999.
 *
 * @throws RangeError for non-integers or values outside the supported range.
 */
export function numberToWords(n: number): string {
  if (!Number.isInteger(n)) {
    throw new RangeError(`numberToWords expects an integer, received ${n}`);
  }
  if (n < 0 || n > MAX) {
    throw new RangeError(`numberToWords is defined for 0..${MAX}, received ${n}`);
  }
  if (n === 0) return 'cero';

  const millions = Math.floor(n / MILLION);
  const rest = n % MILLION;
  const parts: string[] = [];
  if (millions === 1) {
    parts.push('un millón');
  } else if (millions > 1) {
    parts.push(`${wordsWithApocope(millions)} millones`);
  }
  if (rest > 0) parts.push(belowMillion(rest));
  return parts.join(' ');
}

/**
 * The apocopated form used before `mil`, `millón`/`millones`, and masculine
 * nouns: a terminal `uno` becomes `un` and `veintiuno` becomes `veintiún`
 * (e.g. 1 → un euro, 21 → veintiún euros, 21_000 → veintiún mil,
 * 41_000_000 → cuarenta y un millones, 101 → ciento un). Numbers not ending in
 * a lone `1` are returned unchanged.
 */
export function wordsWithApocope(n: number): string {
  const words = numberToWords(n);
  if (words.endsWith('veintiuno')) {
    return `${words.slice(0, -'veintiuno'.length)}veintiún`;
  }
  if (words.endsWith('uno')) {
    return `${words.slice(0, -'uno'.length)}un`;
  }
  return words;
}
