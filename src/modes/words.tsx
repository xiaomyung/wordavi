import { buildAccepted, numberToWords } from '@/engine';
import { numberSource } from './buckets';
import { NumeralPrompt, PromptStage, TypedAnswer } from './prompt';
import type { AnswerZoneProps, LearningMode, PromptProps } from './types';
import { labelOf } from './types';

/**
 * words — number → es-ES spelling (drill-text.html).
 *
 * The prompt is the bare numeral; the learner types the Spanish. Accepted forms
 * come from the engine, so the canonical spelling is always in the variant set.
 */

const LABEL_KEYS = ['common.check', 'drill.type_placeholder'] as const;

function WordsPrompt({ question }: PromptProps) {
  return (
    <PromptStage>
      <NumeralPrompt payload={question.prompt} />
    </PromptStage>
  );
}

function WordsAnswer({ question, verdict, onSubmit, labels }: AnswerZoneProps) {
  return (
    <TypedAnswer
      questionId={question.id}
      mode="words"
      accentKeys
      placeholder={labelOf(labels, 'drill.type_placeholder')}
      submitLabel={labelOf(labels, 'common.check')}
      verdict={verdict}
      onSubmit={onSubmit}
    />
  );
}

export const wordsMode: LearningMode = {
  id: 'words',
  titleKey: 'modes.words.title',
  exampleKey: 'modes.words.example',
  requires: [],
  labelKeys: LABEL_KEYS,
  source: numberSource('words', (value) => buildAccepted(numberToWords(value), [])),
  Prompt: WordsPrompt,
  AnswerZone: WordsAnswer,
};
