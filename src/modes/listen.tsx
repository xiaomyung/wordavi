import { useEffect, useRef } from 'react';
import { PillButton, SpeakerButton } from '@/components';
import { numberSource } from './buckets';
import { PromptStage, promptSpanish, TypedAnswer, useSpeakOnDemand } from './prompt';
import type { AnswerZoneProps, LearningMode, PromptProps } from './types';
import { labelOf } from './types';

/**
 * listen — audio → digits (drill-digits.html, "listening idle" frame).
 *
 * The number is never shown. It plays once by itself when the question appears
 * and then as often as the learner taps; the 0.5x toggle is sticky for the
 * round, so its state lives in the drill and arrives as a prop.
 */

const LABEL_KEYS = [
  'common.check',
  'drill.digits_placeholder',
  'drill.listen_again',
  'drill.slower',
] as const;

function ListenPrompt({ question, services, slower, onToggleSlower, labels }: PromptProps) {
  const phrase = promptSpanish(question.prompt);
  const { speaking: playing, speak: play } = useSpeakOnDemand(services, phrase, slower);
  /** Question id already auto-played — replays are user-driven only. */
  const autoPlayed = useRef<string | null>(null);

  useEffect(() => {
    if (autoPlayed.current === question.id) return;
    autoPlayed.current = question.id;
    play();
  }, [question.id, play]);

  return (
    <PromptStage>
      <SpeakerButton
        playing={playing || services.isSpeaking()}
        onClick={play}
        aria-label={labelOf(labels, 'drill.listen_again')}
      />
      <p className="font-semibold text-label text-text-muted">
        {labelOf(labels, 'drill.listen_again')}
      </p>
      <PillButton active={slower} onClick={onToggleSlower}>
        {labelOf(labels, 'drill.slower')}
      </PillButton>
    </PromptStage>
  );
}

function ListenAnswer({ question, verdict, onSubmit, labels }: AnswerZoneProps) {
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

export const listenMode: LearningMode = {
  id: 'listen',
  titleKey: 'modes.listen.title',
  // No `modes.listen.example` string exists; the mode list shows the `sub` line.
  exampleKey: 'modes.listen.sub',
  requires: ['tts'],
  labelKeys: LABEL_KEYS,
  source: numberSource('listen', (value) => ({ intVal: value })),
  Prompt: ListenPrompt,
  AnswerZone: ListenAnswer,
};
