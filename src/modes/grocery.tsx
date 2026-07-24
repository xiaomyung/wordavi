import { useCallback, useState } from 'react';
import { PillButton, PriceTag } from '@/components';
import { generatePrice, generateQuantity, priceToWords, quantityToWords } from '@/engine';
import type { Question, QuestionSource, SkillBucket } from '@/session';
import type { AnswerZoneProps, LearningMode, PromptProps } from './types';
import { labelOf } from './types';
import { PromptStage, promptDisplay, promptSpanish, SpeakerGlyph, TypedAnswer } from './ui';

/**
 * grocery — shelf price / scale weight → what the cashier says (drill-grocery.html).
 *
 * ## Bucket → generator
 *
 * | bucket        | values drawn                                            |
 * |---------------|---------------------------------------------------------|
 * | price_cents   | engine `generatePrice` (1–20 € heavy, ,99/,95/,50 endings)|
 * | qty_fractions | weights that are whole multiples of 250 g — the named    |
 * |               | fractions the classifier routes here: cuarto/medio/tres   |
 * |               | cuartos de kilo, whole kilos, "kilo y medio"              |
 * | qty_grams     | everything else: sub-kilo gram counts (50–800 g) and      |
 * |               | non-half decimal kilos (1,2 / 1,8 / 2,2 kg)              |
 *
 * The number-range slider is deliberately ignored: shop prices and weights have
 * their own natural scale, and clamping "medio kilo" to a 0–100 range would only
 * gut the mode. Every bucket it declares is therefore always eligible.
 */

const GROCERY_BUCKETS = [
  'price_cents',
  'qty_fractions',
  'qty_grams',
] as const satisfies readonly SkillBucket[];

/** Multiples of 250 g — `classifyBucket` routes these to `qty_fractions`. */
const FRACTION_GRAMS: ReadonlyArray<readonly [number, number]> = [
  [250, 3],
  [500, 4],
  [750, 3],
  [1000, 4],
  [1500, 3],
  [2000, 2],
  [2500, 2],
  [3000, 1],
  [3500, 1],
];

/** Weights that are NOT multiples of 250 g — they land in `qty_grams`. */
const GRAM_ONLY: ReadonlyArray<readonly [number, number]> = [
  [50, 1],
  [100, 3],
  [150, 2],
  [200, 3],
  [300, 3],
  [400, 2],
  [600, 2],
  [800, 2],
  [1200, 2],
  [1800, 1],
  [2200, 1],
];

/** Mode-wide mix when no bucket is suggested: roughly 60% prices, 40% weights. */
const KIND_MIX: ReadonlyArray<readonly [string, number]> = [
  ['price', 6],
  ['quantity', 4],
];

const LABEL_KEYS = [
  'common.check',
  'drill.grocery_placeholder',
  'drill.cashier_hint',
  'drill.listen',
] as const;

function priceQuestion(euros: number, cents: number): Question {
  return {
    id: `grocery:p${euros}.${cents}`,
    bucket: 'price_cents',
    prompt: { kind: 'price', euros, cents },
    accepted: priceToWords(euros, cents),
  };
}

function weightQuestion(grams: number): Question {
  return {
    id: `grocery:q${grams}`,
    // Re-stamped by the round via classifyBucket; kept honest here anyway.
    bucket: grams % 250 === 0 ? 'qty_fractions' : 'qty_grams',
    prompt: { kind: 'quantity', grams },
    accepted: quantityToWords({ kind: 'weight', grams }),
  };
}

export const grocerySource: QuestionSource = {
  eligibleBuckets: () => GROCERY_BUCKETS,
  generate(rng, ctx): Question {
    switch (ctx.suggestedBucket) {
      case 'price_cents': {
        const price = generatePrice(rng);
        return priceQuestion(price.euros, price.cents);
      }
      case 'qty_fractions':
        return weightQuestion(rng.weighted(FRACTION_GRAMS));
      case 'qty_grams':
        return weightQuestion(rng.weighted(GRAM_ONLY));
      default: {
        if (rng.weighted(KIND_MIX) === 'price') {
          const price = generatePrice(rng);
          return priceQuestion(price.euros, price.cents);
        }
        return weightQuestion(generateQuantity(rng).grams);
      }
    }
  },
};

function GroceryPrompt({ question, services, slower, labels }: PromptProps) {
  const phrase = promptSpanish(question.prompt);
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback(() => {
    setSpeaking(true);
    services
      .speak(phrase, { slower })
      .catch(() => undefined)
      .finally(() => setSpeaking(false));
  }, [services, phrase, slower]);

  return (
    <PromptStage>
      <PriceTag>{promptDisplay(question.prompt)}</PriceTag>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="font-semibold text-label text-text-muted">
          {labelOf(labels, 'drill.cashier_hint')}
        </span>
        <PillButton glyph={<SpeakerGlyph />} onClick={speak} disabled={speaking}>
          {labelOf(labels, 'drill.listen')}
        </PillButton>
      </div>
    </PromptStage>
  );
}

function GroceryAnswer({ question, verdict, onSubmit, labels }: AnswerZoneProps) {
  return (
    <TypedAnswer
      questionId={question.id}
      mode="words"
      accentKeys
      placeholder={labelOf(labels, 'drill.grocery_placeholder')}
      submitLabel={labelOf(labels, 'common.check')}
      verdict={verdict}
      onSubmit={onSubmit}
    />
  );
}

export const groceryMode: LearningMode = {
  id: 'grocery',
  titleKey: 'modes.grocery.title',
  exampleKey: 'modes.grocery.example',
  requires: ['tts'],
  labelKeys: LABEL_KEYS,
  source: grocerySource,
  Prompt: GroceryPrompt,
  AnswerZone: GroceryAnswer,
};
