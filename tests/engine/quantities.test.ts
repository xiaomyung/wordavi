import { describe, expect, it } from 'vitest';
import { matchText, type NoteKey, quantityToWords } from '@/engine';

const OPTS = { acceptNoAccents: true };

interface WeightCase {
  grams: number;
  canonical: string;
  phrases: Array<[string, NoteKey | undefined]>;
}

const CASES: WeightCase[] = [
  {
    grams: 500,
    canonical: 'medio kilo',
    phrases: [
      ['medio kilo', undefined],
      ['medio kilogramo', undefined],
      ['quinientos gramos', 'crossUnit'],
    ],
  },
  {
    grams: 250,
    canonical: 'cuarto de kilo',
    phrases: [
      ['cuarto de kilo', undefined],
      ['un cuarto de kilo', undefined],
      ['doscientos cincuenta gramos', 'crossUnit'],
    ],
  },
  {
    grams: 750,
    canonical: 'tres cuartos de kilo',
    phrases: [
      ['tres cuartos de kilo', undefined],
      ['setecientos cincuenta gramos', 'crossUnit'],
    ],
  },
  {
    grams: 1500,
    canonical: 'kilo y medio',
    phrases: [
      ['kilo y medio', undefined],
      ['un kilo y medio', undefined],
      ['mil quinientos gramos', 'crossUnit'],
      ['uno coma cinco kilos', 'crossUnit'],
    ],
  },
  {
    grams: 1000,
    canonical: 'un kilo',
    phrases: [
      ['un kilo', undefined],
      ['un kilogramo', undefined],
      ['mil gramos', 'crossUnit'],
    ],
  },
  {
    grams: 2000,
    canonical: 'dos kilos',
    phrases: [
      ['dos kilos', undefined],
      ['dos kilogramos', undefined],
      ['dos mil gramos', 'crossUnit'],
    ],
  },
  {
    grams: 2500,
    canonical: 'dos kilos y medio',
    phrases: [
      ['dos kilos y medio', undefined],
      ['dos mil quinientos gramos', 'crossUnit'],
      ['dos coma cinco kilos', 'crossUnit'],
    ],
  },
  {
    grams: 1200,
    canonical: 'uno coma dos kilos',
    phrases: [
      ['uno coma dos kilos', undefined],
      ['mil doscientos gramos', 'crossUnit'],
      ['un kilo doscientos', 'colloquial'],
    ],
  },
  {
    grams: 300,
    canonical: 'trescientos gramos',
    phrases: [['trescientos gramos', undefined]],
  },
];

interface ApocopeCase {
  grams: number;
  canonical: string;
  /** The whole accepted set, canonical first, with the note each carries. */
  accepted: Array<[string, NoteKey | undefined]>;
}

// Boundaries where a count ending in a lone "1" meets a unit noun.
const APOCOPE_CASES: ApocopeCase[] = [
  { grams: 1, canonical: 'un gramo', accepted: [['un gramo', undefined]] },
  { grams: 21, canonical: 'veintiún gramos', accepted: [['veintiún gramos', undefined]] },
  { grams: 31, canonical: 'treinta y un gramos', accepted: [['treinta y un gramos', undefined]] },
  { grams: 41, canonical: 'cuarenta y un gramos', accepted: [['cuarenta y un gramos', undefined]] },
  { grams: 100, canonical: 'cien gramos', accepted: [['cien gramos', undefined]] },
  { grams: 101, canonical: 'ciento un gramos', accepted: [['ciento un gramos', undefined]] },
  {
    grams: 121,
    canonical: 'ciento veintiún gramos',
    accepted: [['ciento veintiún gramos', undefined]],
  },
  {
    grams: 1000,
    canonical: 'un kilo',
    accepted: [
      ['un kilo', undefined],
      ['un kilogramo', undefined],
      ['mil gramos', 'crossUnit'],
    ],
  },
  {
    grams: 1001,
    canonical: 'uno coma cero cero uno kilos',
    accepted: [
      ['uno coma cero cero uno kilos', undefined],
      ['mil un gramos', 'crossUnit'],
      ['un kilo uno', 'colloquial'],
      ['un kilo un', 'colloquial'],
    ],
  },
  {
    grams: 21_000,
    canonical: 'veintiún kilos',
    accepted: [
      ['veintiún kilos', undefined],
      ['veintiún kilogramos', undefined],
      ['veintiún mil gramos', 'crossUnit'],
    ],
  },
  {
    grams: 31_000,
    canonical: 'treinta y un kilos',
    accepted: [
      ['treinta y un kilos', undefined],
      ['treinta y un kilogramos', undefined],
      ['treinta y un mil gramos', 'crossUnit'],
    ],
  },
  {
    grams: 41_000,
    canonical: 'cuarenta y un kilos',
    accepted: [
      ['cuarenta y un kilos', undefined],
      ['cuarenta y un kilogramos', undefined],
      ['cuarenta y un mil gramos', 'crossUnit'],
    ],
  },
  {
    grams: 100_000,
    canonical: 'cien kilos',
    accepted: [
      ['cien kilos', undefined],
      ['cien kilogramos', undefined],
      ['cien mil gramos', 'crossUnit'],
    ],
  },
  {
    grams: 101_000,
    canonical: 'ciento un kilos',
    accepted: [
      ['ciento un kilos', undefined],
      ['ciento un kilogramos', undefined],
      ['ciento un mil gramos', 'crossUnit'],
    ],
  },
  {
    grams: 121_000,
    canonical: 'ciento veintiún kilos',
    accepted: [
      ['ciento veintiún kilos', undefined],
      ['ciento veintiún kilogramos', undefined],
      ['ciento veintiún mil gramos', 'crossUnit'],
    ],
  },
  {
    grams: 1_001_000,
    canonical: 'mil un kilos',
    accepted: [
      ['mil un kilos', undefined],
      ['mil un kilogramos', undefined],
      ['un millón mil gramos', 'crossUnit'],
    ],
  },
  {
    grams: 21_500,
    canonical: 'veintiún kilos y medio',
    accepted: [
      ['veintiún kilos y medio', undefined],
      ['veintiún kilogramos y medio', undefined],
      ['veintiún mil quinientos gramos', 'crossUnit'],
      ['veintiuno coma cinco kilos', 'crossUnit'],
    ],
  },
  {
    grams: 21_200,
    canonical: 'veintiuno coma dos kilos',
    accepted: [
      ['veintiuno coma dos kilos', undefined],
      ['veintiún mil doscientos gramos', 'crossUnit'],
      ['veintiún kilos doscientos', 'colloquial'],
    ],
  },
];

describe('quantityToWords apocope before a unit noun', () => {
  for (const testCase of APOCOPE_CASES) {
    const accepted = quantityToWords({ kind: 'weight', grams: testCase.grams });

    it(`${testCase.grams}g reads "${testCase.canonical}"`, () => {
      expect(accepted.canonical).toBe(testCase.canonical);
      expect(accepted.variants.map((variant) => variant.text)).toEqual(
        testCase.accepted.map(([text]) => text),
      );
    });

    for (const [phrase, note] of testCase.accepted) {
      it(`${testCase.grams}g accepts "${phrase}"${note ? ` (${note})` : ''}`, () => {
        const result = matchText(accepted, phrase, OPTS);
        expect(result.verdict).toBe('correct');
        expect(result.noteKey).toBe(note);
      });
    }
  }

  it.each([
    [21, 'veintiuno gramos'],
    [31, 'treinta y uno gramos'],
    [101, 'ciento uno gramos'],
    [21_000, 'veintiuno kilos'],
    [21_000, 'veintiuno kilogramos'],
    [101_000, 'ciento uno kilos'],
    [21_500, 'veintiuno kilos y medio'],
  ])('%ig rejects the unapocopated "%s"', (grams, phrase) => {
    const accepted = quantityToWords({ kind: 'weight', grams });
    expect(matchText(accepted, phrase, OPTS).verdict).toBe('wrong');
  });
});

describe('quantityToWords accepted set', () => {
  for (const testCase of CASES) {
    const accepted = quantityToWords({ kind: 'weight', grams: testCase.grams });

    it(`${testCase.grams}g has the expected canonical`, () => {
      expect(accepted.canonical).toBe(testCase.canonical);
    });

    for (const [phrase, note] of testCase.phrases) {
      it(`${testCase.grams}g accepts "${phrase}"${note ? ` (${note})` : ''}`, () => {
        const result = matchText(accepted, phrase, OPTS);
        expect(result.verdict).toBe('correct');
        expect(result.noteKey).toBe(note);
      });
    }
  }
});
