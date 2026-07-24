import { describe, expect, it } from 'vitest';
import { matchText, type NoteKey, priceToWords } from '@/engine';

const OPTS = { acceptNoAccents: true };

interface PriceCase {
  euros: number;
  cents: number;
  canonical: string;
  phrases: Array<[string, NoteKey | undefined]>;
}

const CASES: PriceCase[] = [
  {
    euros: 4,
    cents: 75,
    canonical: 'cuatro con setenta y cinco',
    phrases: [
      ['cuatro con setenta y cinco', undefined],
      ['cuatro euros setenta y cinco', undefined],
      ['cuatro euros con setenta y cinco', undefined],
      ['cuatro euros y setenta y cinco céntimos', undefined],
      ['cuatro setenta y cinco', 'colloquial'],
      ['cuatro coma setenta y cinco', 'colloquial'],
    ],
  },
  {
    euros: 1,
    cents: 0,
    canonical: 'un euro',
    phrases: [
      ['un euro', undefined],
      ['uno', 'colloquial'],
    ],
  },
  {
    euros: 0,
    cents: 75,
    canonical: 'setenta y cinco céntimos',
    phrases: [
      ['setenta y cinco céntimos', undefined],
      ['cero con setenta y cinco', 'colloquial'],
      ['cero coma setenta y cinco', 'colloquial'],
    ],
  },
  {
    euros: 21,
    cents: 0,
    canonical: 'veintiún euros',
    phrases: [
      ['veintiún euros', undefined],
      ['veintiuno', 'colloquial'],
    ],
  },
  {
    euros: 1,
    cents: 5,
    canonical: 'uno con cero cinco',
    phrases: [
      ['uno con cero cinco', undefined],
      ['un euro con cinco céntimos', undefined],
      ['un euro y cinco céntimos', undefined],
      ['un euro con cero cinco', undefined],
      ['uno coma cero cinco', 'colloquial'],
    ],
  },
  {
    euros: 12,
    cents: 99,
    canonical: 'doce con noventa y nueve',
    phrases: [
      ['doce con noventa y nueve', undefined],
      ['doce euros noventa y nueve', undefined],
      ['doce euros y noventa y nueve céntimos', undefined],
      ['doce noventa y nueve', 'colloquial'],
      ['doce coma noventa y nueve', 'colloquial'],
    ],
  },
];

describe('priceToWords accepted set', () => {
  for (const testCase of CASES) {
    const accepted = priceToWords(testCase.euros, testCase.cents);

    it(`${testCase.euros},${testCase.cents} has the expected canonical`, () => {
      expect(accepted.canonical).toBe(testCase.canonical);
    });

    for (const [phrase, note] of testCase.phrases) {
      it(`${testCase.euros},${testCase.cents} accepts "${phrase}"${note ? ` (${note})` : ''}`, () => {
        const result = matchText(accepted, phrase, OPTS);
        expect(result.verdict).toBe('correct');
        expect(result.noteKey).toBe(note);
      });
    }
  }
});

describe('priceToWords apocope and gender', () => {
  it('says "un euro", never "uno euro"', () => {
    const accepted = priceToWords(1, 0);
    expect(accepted.canonical).toBe('un euro');
    expect(matchText(accepted, 'uno euro', OPTS).verdict).toBe('wrong');
  });

  it('uses masculine "veintiún"/"veintiuno", never feminine "veintiuna"', () => {
    const accepted = priceToWords(21, 0);
    expect(matchText(accepted, 'veintiuna euros', OPTS).verdict).toBe('wrong');
    expect(matchText(accepted, 'veintiuna', OPTS).verdict).toBe('wrong');
  });

  it('says "un céntimo" for a single cent', () => {
    const accepted = priceToWords(0, 1);
    expect(accepted.canonical).toBe('un céntimo');
    expect(matchText(accepted, 'un céntimo', OPTS).verdict).toBe('correct');
  });

  it('says "cinco euros" for an exact five, with a colloquial "cinco"', () => {
    const accepted = priceToWords(5, 0);
    expect(accepted.canonical).toBe('cinco euros');
    expect(matchText(accepted, 'cinco', OPTS).noteKey).toBe('colloquial');
  });
});
