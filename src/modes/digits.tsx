import { useCallback, useState } from 'react';
import { PillButton } from '@/components';
import { numberSource } from './buckets';
import type { AnswerZoneProps, LearningMode, PromptProps } from './types';
import { labelOf } from './types';
import { PromptStage, promptSpanish, SpanishPhrase, SpeakerGlyph, TypedAnswer } from './ui';

/**
 * digits — es-ES words → number (drill-digits.html, "words→digits" frame).
 *
 * The phrase is on screen, so audio is an *option*, never automatic: the pill
 * speaks only on demand. That is why the mode requires no capability — with no
 * voice installed the pill is simply inert and the drill still works.
 */

const LABEL_KEYS = ['common.check', 'drill.digits_placeholder', 'drill.listen'] as const;

function DigitsPrompt({ question, services, slower, labels }: PromptProps) {
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
      <SpanishPhrase text={phrase} />
      <PillButton glyph={<SpeakerGlyph />} onClick={speak} disabled={speaking}>
        {labelOf(labels, 'drill.listen')}
      </PillButton>
    </PromptStage>
  );
}

function DigitsAnswer({ question, verdict, onSubmit, labels }: AnswerZoneProps) {
  return (
    <TypedAnswer
      questionId={question.id}
      mode="digits"
      accentKeys={false}
      placeholder={labelOf(labels, 'drill.digits_placeholder')}
      submitLabel={labelOf(labels, 'common.check')}
      verdict={verdict}
      onSubmit={onSubmit}
    />
  );
}

export const digitsMode: LearningMode = {
  id: 'digits',
  titleKey: 'modes.digits.title',
  exampleKey: 'modes.digits.example',
  requires: [],
  labelKeys: LABEL_KEYS,
  source: numberSource('digits', (value) => ({ intVal: value })),
  Prompt: DigitsPrompt,
  AnswerZone: DigitsAnswer,
};
