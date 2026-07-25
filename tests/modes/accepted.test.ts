import { describe, expect, it } from 'vitest';
import {
  type AcceptedAnswer,
  matchText,
  numberToWords,
  priceToWords,
  quantityToWords,
} from '@/engine';
import { getMode, NUMBER_BUCKETS } from '@/modes';
import type { AcceptedDigits, SkillBucket } from '@/session';
import { generateFor, roundConfig } from './helpers';

const SEEDS = [2, 13, 77, 404, 5150];

function words(accepted: unknown): AcceptedAnswer {
  return accepted as AcceptedAnswer;
}

function digits(accepted: unknown): AcceptedDigits {
  return accepted as AcceptedDigits;
}

describe.each(['words', 'speak'] as const)('%s accepted set', (id) => {
  const mode = getMode(id);

  it('accepts the engine spelling of the generated value, accents required', () => {
    for (const bucket of NUMBER_BUCKETS) {
      for (const seed of SEEDS) {
        const question = generateFor(mode, bucket, seed);
        if (question.prompt.kind !== 'number') throw new Error('expected a number payload');
        const spelling = numberToWords(question.prompt.value);
        const result = matchText(words(question.accepted), spelling, { acceptNoAccents: false });
        expect(result.verdict, `${bucket} @ ${seed} → ${spelling}`).toBe('correct');
      }
    }
  });

  it('keeps the canonical spelling inside the variant set', () => {
    const question = generateFor(mode, 'twenties_fused', 3);
    const accepted = words(question.accepted);
    expect(accepted.variants.map((variant) => variant.text)).toContain(accepted.canonical);
  });

  it('rejects a wrong spelling', () => {
    const question = generateFor(mode, 'hundreds_irreg', 8);
    expect(
      matchText(words(question.accepted), 'doscientos treinta', { acceptNoAccents: true }).verdict,
    ).toBe('wrong');
  });
});

describe.each(['digits', 'listen', 'choice'] as const)('%s accepted set', (id) => {
  const mode = getMode(id);

  it('targets the generated integer, with no fractional part', () => {
    for (const bucket of NUMBER_BUCKETS) {
      for (const seed of SEEDS) {
        const question = generateFor(mode, bucket, seed);
        if (question.prompt.kind !== 'number') throw new Error('expected a number payload');
        const accepted = digits(question.accepted);
        expect(accepted.intVal, `${bucket} @ ${seed}`).toBe(question.prompt.value);
        expect(accepted.fracDigits).toBeUndefined();
      }
    }
  });
});

describe('grocery accepted set', () => {
  const grocery = getMode('grocery');
  const buckets: readonly SkillBucket[] = ['price_cents', 'qty_fractions', 'qty_grams'];

  it('accepts the cashier phrasing the engine builds for the payload', () => {
    for (const bucket of buckets) {
      for (const seed of SEEDS) {
        const question = generateFor(grocery, bucket, seed, roundConfig({ modeId: 'grocery' }));
        const payload = question.prompt;
        const expected =
          payload.kind === 'price'
            ? priceToWords(payload.euros, payload.cents)
            : payload.kind === 'quantity'
              ? quantityToWords({ kind: 'weight', grams: payload.grams })
              : null;
        if (expected === null) throw new Error(`unexpected payload kind ${payload.kind}`);
        expect(words(question.accepted).canonical).toBe(expected.canonical);
        expect(
          matchText(words(question.accepted), expected.canonical, { acceptNoAccents: false })
            .verdict,
        ).toBe('correct');
      }
    }
  });

  it('accepts a noted cross-unit variant as correct', () => {
    // 500 g is the "medio kilo" fixture; "quinientos gramos" is crossUnit.
    const question = generateFor(grocery, 'qty_fractions', 1);
    const accepted = words(question.accepted);
    for (const variant of accepted.variants) {
      const result = matchText(accepted, variant.text, { acceptNoAccents: false });
      expect(result.verdict, variant.text).toBe('correct');
    }
  });
});
