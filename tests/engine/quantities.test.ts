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
