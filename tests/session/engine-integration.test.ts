import { describe, expect, it } from 'vitest';
import { createRng, decimalToWords, numberToWords, priceToWords, quantityToWords } from '@/engine';
import {
  answerQuestion,
  createRound,
  finishRound,
  initSrs,
  makeCountingRng,
  nextQuestion,
  type Question,
  type QuestionSource,
  type RoundConfig,
} from '@/session';
import { numberQuestion } from './helpers';

/**
 * The session layer grades through the real engine — these tests wire genuine
 * `@/engine` accepted-answer sets into a round and assert the verdicts a learner
 * would actually get. If the engine contract shifts, this suite fails here rather
 * than silently in production.
 */

const config: RoundConfig = { modeId: 'm', size: 'endless', rangeMin: 0, rangeMax: 1e6, seed: 11 };

/** A source that serves one fixed question, so grading is the only variable. */
function oneQuestion(q: Question): QuestionSource {
  return {
    eligibleBuckets: () => [q.bucket],
    generate: (rng) => {
      rng.next();
      return q;
    },
  };
}

function grade(q: Question, given: string): { verdict: string; noteKey?: string } {
  let state = createRound(config, initSrs(), oneQuestion(q));
  state = nextQuestion(state);
  const { record } = answerQuestion(state, given);
  return record.noteKey === undefined
    ? { verdict: record.verdict }
    : { verdict: record.verdict, noteKey: record.noteKey };
}

describe('engine integration — numbers', () => {
  const cases: [number, string][] = [
    [15, 'quince'],
    [16, 'dieciséis'],
    [21, 'veintiuno'],
    [31, 'treinta y uno'],
    [100, 'cien'],
    [101, 'ciento uno'],
    [500, 'quinientos'],
    [1000, 'mil'],
    [21_000, 'veintiún mil'],
    [1_000_000, 'un millón'],
  ];

  for (const [value, words] of cases) {
    it(`${value} is spoken "${words}" and grades correct`, () => {
      expect(numberToWords(value)).toBe(words);
      expect(grade(numberQuestion(`n${value}`, value), words)).toEqual({ verdict: 'correct' });
    });
  }

  it('rejects the archaic "veinte y uno" for 21', () => {
    expect(grade(numberQuestion('n21', 21), 'veinte y uno')).toEqual({ verdict: 'wrong' });
  });

  it('forgives a dropped accent with an almost + accent note', () => {
    expect(grade(numberQuestion('n16', 16), 'dieciseis')).toEqual({
      verdict: 'almost',
      noteKey: 'accent',
    });
  });
});

describe('engine integration — prices, quantities, decimals', () => {
  const price: Question = {
    id: 'p475',
    bucket: 'price_cents',
    prompt: { kind: 'price', euros: 4, cents: 75 },
    accepted: priceToWords(4, 75),
  };

  it('accepts the whole cashier phrasing set for 4,75 €', () => {
    for (const given of [
      'cuatro con setenta y cinco',
      'cuatro euros con setenta y cinco',
      'cuatro euros setenta y cinco',
      'cuatro euros y setenta y cinco céntimos',
    ]) {
      expect(grade(price, given).verdict).toBe('correct');
    }
    expect(grade(price, 'cuatro con cincuenta').verdict).toBe('wrong');
  });

  it('carries the crossUnit note on an equivalent weight phrasing', () => {
    const q: Question = {
      id: 'w500',
      bucket: 'qty_fractions',
      prompt: { kind: 'quantity', grams: 500 },
      accepted: quantityToWords({ kind: 'weight', grams: 500 }),
    };
    expect(grade(q, 'medio kilo')).toEqual({ verdict: 'correct' });
    // Cross-unit equivalents stay fully correct; the note is the UI's hint.
    expect(grade(q, 'quinientos gramos')).toEqual({ verdict: 'correct', noteKey: 'crossUnit' });
  });

  it('takes "coma" as canonical and "con" as an accepted decimal reading', () => {
    const q: Question = {
      id: 'd314',
      bucket: 'decimals',
      prompt: { kind: 'decimal', intPart: 3, fracDigits: '14' },
      accepted: decimalToWords(3, '14'),
    };
    expect(grade(q, 'tres coma catorce')).toEqual({ verdict: 'correct' });
    expect(grade(q, 'tres con catorce')).toEqual({ verdict: 'correct', noteKey: 'conAccepted' });
  });
});

describe('engine integration — counting rng', () => {
  it('reproduces the engine stream exactly and counts every draw', () => {
    const reference = createRng(4242);
    const expected = [reference.next(), reference.int(1, 6), reference.pick([1, 2, 3])];

    const counting = makeCountingRng(4242, 0);
    expect(counting.draws()).toBe(0);
    expect([counting.rng.next(), counting.rng.int(1, 6), counting.rng.pick([1, 2, 3])]).toEqual(
      expected,
    );
    expect(counting.draws()).toBe(3);
  });

  it('skipping N draws resumes mid-stream', () => {
    const whole = makeCountingRng(7, 0);
    const first = [whole.rng.next(), whole.rng.next()];
    const rest = [whole.rng.next(), whole.rng.next()];
    expect(first).toHaveLength(2);

    const resumed = makeCountingRng(7, 2);
    expect(resumed.draws()).toBe(2);
    expect([resumed.rng.next(), resumed.rng.next()]).toEqual(rest);
    expect(resumed.draws()).toBe(4);
  });

  it('a throwing draw does not advance the count', () => {
    const counting = makeCountingRng(1, 0);
    expect(() => counting.rng.pick([])).toThrow();
    expect(counting.draws()).toBe(0);
  });
});

describe('engine integration — a real drill scores end to end', () => {
  it('runs number questions built by the engine and tallies points', () => {
    const values = [7, 16, 45];
    let i = 0;
    const source: QuestionSource = {
      eligibleBuckets: () => ['d0_15', 'teens_fused', 'tens_y'],
      generate: (rng) => {
        const value = values[i % values.length] as number;
        i += 1;
        rng.next();
        return {
          id: `q${i}`,
          bucket: 'd0_15',
          prompt: { kind: 'number', value },
          accepted: { canonical: numberToWords(value), variants: [{ text: numberToWords(value) }] },
        };
      },
    };

    let state = createRound({ ...config, size: 3 }, initSrs(), source);
    for (const given of ['siete', 'dieciseis', 'cuarenta y cinco']) {
      state = nextQuestion(state);
      state = answerQuestion(state, given).state;
    }
    const summary = finishRound(state);
    expect(summary.points).toBe(28); // 10 + 8 (accent) + 10
    // The round classifies each question itself, overriding the source's claim.
    expect(summary.verdicts.map((v) => v.bucket)).toEqual(['d0_15', 'teens_fused', 'tens_y']);
    expect(state.srs.buckets.teens_fused.attempts).toBe(1);
  });
});
