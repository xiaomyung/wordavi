import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AcceptedAnswer } from '@/engine';
import { matchText, numberToWords, stripAccents, wordsWithApocope } from '@/engine';
import { GOLDEN_0_1000 } from './golden-0-1000';

const MAX = 999_999_999_999;

/** Wrap a canonical spelling as a single-variant accepted answer. */
function toAccepted(words: string): AcceptedAnswer {
  return { canonical: words, variants: [{ text: words }] };
}

const TENS_WORDS = new Set([
  'treinta',
  'cuarenta',
  'cincuenta',
  'sesenta',
  'setenta',
  'ochenta',
  'noventa',
]);
// Units that may follow "y": the full unit words plus the apocopated "un"
// (e.g. "ochenta y un mil", "cuarenta y un millones").
const UNIT_WORDS = new Set([
  'uno',
  'un',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
]);

/** "y" is legal only wedged between a tens word (30–90) and a unit (1–9). */
function everyYIsTensUnit(words: string): boolean {
  const tokens = words.split(' ');
  return tokens.every((token, i) => {
    if (token !== 'y') return true;
    const before = tokens[i - 1];
    const after = tokens[i + 1];
    return (
      before !== undefined && after !== undefined && TENS_WORDS.has(before) && UNIT_WORDS.has(after)
    );
  });
}

describe('numberToWords — golden reference 0..1000', () => {
  it('matches the hand-authored fixture for every integer 0..1000', () => {
    expect(GOLDEN_0_1000).toHaveLength(1001);
    const mismatches: Array<{ n: number; got: string; want: string }> = [];
    for (let n = 0; n <= 1000; n += 1) {
      const want = GOLDEN_0_1000[n] as string;
      const got = numberToWords(n);
      if (got !== want) mismatches.push({ n, got, want });
    }
    expect(mismatches).toEqual([]);
  });
});

describe('numberToWords — boundary table', () => {
  const cases: Array<[number, string]> = [
    [15, 'quince'],
    [16, 'dieciséis'],
    [20, 'veinte'],
    [21, 'veintiuno'],
    [29, 'veintinueve'],
    [30, 'treinta'],
    [99, 'noventa y nueve'],
    [100, 'cien'],
    [101, 'ciento uno'],
    [199, 'ciento noventa y nueve'],
    [200, 'doscientos'],
    [499, 'cuatrocientos noventa y nueve'],
    [500, 'quinientos'],
    [501, 'quinientos uno'],
    [700, 'setecientos'],
    [900, 'novecientos'],
    [999, 'novecientos noventa y nueve'],
    [1000, 'mil'],
    [1001, 'mil uno'],
    [1999, 'mil novecientos noventa y nueve'],
    [2000, 'dos mil'],
    [21_000, 'veintiún mil'],
    [31_000, 'treinta y un mil'],
    [41_000_000, 'cuarenta y un millones'],
    [100_000, 'cien mil'],
    [101_000, 'ciento un mil'],
    [999_999, 'novecientos noventa y nueve mil novecientos noventa y nueve'],
    [1_000_000, 'un millón'],
    [1_000_001, 'un millón uno'],
    [2_000_000, 'dos millones'],
    [1_000_000_000, 'mil millones'],
    [
      999_999_999_999,
      'novecientos noventa y nueve mil novecientos noventa y nueve millones novecientos noventa y nueve mil novecientos noventa y nueve',
    ],
  ];

  it.each(cases)('numberToWords(%i) === %s', (n, expected) => {
    expect(numberToWords(n)).toBe(expected);
  });
});

describe('numberToWords — range guard', () => {
  it('throws RangeError below 0 and above the maximum', () => {
    expect(() => numberToWords(-1)).toThrow(RangeError);
    expect(() => numberToWords(MAX + 1)).toThrow(RangeError);
    expect(() => numberToWords(1_000_000_000_000)).toThrow(RangeError);
  });

  it('throws RangeError for non-integers and non-finite input', () => {
    expect(() => numberToWords(1.5)).toThrow(RangeError);
    expect(() => numberToWords(Number.NaN)).toThrow(RangeError);
    expect(() => numberToWords(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('accepts the exact endpoints', () => {
    expect(numberToWords(0)).toBe('cero');
    expect(numberToWords(MAX)).not.toBe('');
  });
});

describe('wordsWithApocope', () => {
  const cases: Array<[number, string]> = [
    [1, 'un'],
    [21, 'veintiún'],
    [31, 'treinta y un'],
    [41, 'cuarenta y un'],
    [101, 'ciento un'],
    [121, 'ciento veintiún'],
    [1001, 'mil un'],
    [100_001, 'cien mil un'],
  ];
  it.each(cases)('wordsWithApocope(%i) === %s', (n, expected) => {
    expect(wordsWithApocope(n)).toBe(expected);
  });

  const unchanged: Array<[number, string]> = [
    [2, 'dos'],
    [15, 'quince'],
    [100, 'cien'],
    [1000, 'mil'],
    [111, 'ciento once'],
    [20, 'veinte'],
  ];
  it.each(unchanged)('wordsWithApocope(%i) leaves %s unchanged', (n, expected) => {
    expect(wordsWithApocope(n)).toBe(expected);
  });
});

describe('numberToWords — structural properties', () => {
  it('16–29 are single fused words (no space)', () => {
    for (let n = 16; n <= 29; n += 1) {
      expect(numberToWords(n)).not.toContain(' ');
    }
  });

  it('never emits leading/trailing space or a double space', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX }), (n) => {
        const words = numberToWords(n);
        expect(words.length).toBeGreaterThan(0);
        expect(words).toBe(words.trim());
        expect(words).not.toMatch(/ {2,}/);
      }),
    );
  });

  it('"y" appears only between a tens word and a unit', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX }), (n) => {
        expect(everyYIsTensUnit(numberToWords(n))).toBe(true);
      }),
    );
  });

  it('never emits the bare "un mil" (1000 is "mil")', () => {
    expect(numberToWords(1000)).toBe('mil');
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX }), (n) => {
        expect(numberToWords(n).startsWith('un mil')).toBe(false);
      }),
    );
  });

  it('never accepts an archaic three-word teen/twenty (e.g. "diez y seis")', () => {
    expect(
      matchText(toAccepted('dieciséis'), 'diez y seis', { acceptNoAccents: true }).verdict,
    ).toBe('wrong');
    expect(
      matchText(toAccepted('veintiuno'), 'veinte y uno', { acceptNoAccents: true }).verdict,
    ).toBe('wrong');
  });

  it('round-trips: matchText(accepted(n), numberToWords(n)) is correct', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX }), (n) => {
        const words = numberToWords(n);
        expect(matchText(toAccepted(words), words, { acceptNoAccents: true }).verdict).toBe(
          'correct',
        );
      }),
    );
  });

  it('accent-stripped input is "almost" when accents are forgiven, "wrong" when not', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX }), (n) => {
        const words = numberToWords(n);
        const stripped = stripAccents(words);
        if (stripped === words) return; // no accent in this number — nothing to test
        const accepted = toAccepted(words);
        expect(matchText(accepted, stripped, { acceptNoAccents: true }).verdict).toBe('almost');
        expect(matchText(accepted, stripped, { acceptNoAccents: false }).verdict).toBe('wrong');
      }),
    );
  });
});
