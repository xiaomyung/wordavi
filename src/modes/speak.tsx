import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { MicState } from '@/components';
import { Button, MicButton, Transcript, VerdictBlock } from '@/components';
import {
  type AcceptedAnswer,
  buildAccepted,
  matchText,
  numberToWords,
  type VerdictKind,
} from '@/engine';
import type { Question } from '@/session';
import { numberSource } from './buckets';
import type {
  AnswerZoneProps,
  LearningMode,
  PromptProps,
  RecognitionErrorKind,
  RecognitionSession,
} from './types';
import { labelOf } from './types';
import { NumeralPrompt, PromptStage, TypedAnswer } from './ui';

/**
 * speak — numeral on screen, answer with the voice (drill-mic.html).
 *
 * ## Interim transcript across the two zones
 *
 * The mockup puts the live transcript under the numeral (prompt zone) while the
 * microphone lives in the answer zone, and the drill contract deliberately keeps
 * those two components independent. They therefore share one module-scoped
 * store: the answer zone publishes interim text, the prompt subscribes. Only one
 * drill runs at a time, so a singleton is the whole lifetime it needs.
 */

/* ------------------------------------------------------------------ *
 * Interim transcript store
 * ------------------------------------------------------------------ */

/** The transcript is stamped with its question, so it can never outlive it. */
interface InterimState {
  questionId: string;
  text: string;
}

let interim: InterimState = { questionId: '', text: '' };
const interimListeners = new Set<() => void>();

function subscribeInterim(listener: () => void): () => void {
  interimListeners.add(listener);
  return () => {
    interimListeners.delete(listener);
  };
}

function readInterim(): InterimState {
  return interim;
}

/** Publish (or clear) the live transcript for one question. */
export function setInterim(questionId: string, text: string): void {
  if (interim.questionId === questionId && interim.text === text) return;
  interim = { questionId, text };
  for (const listener of interimListeners) listener();
}

/* ------------------------------------------------------------------ *
 * Alternative picking
 * ------------------------------------------------------------------ */

const RANK: Record<VerdictKind, number> = { wrong: 0, almost: 1, correct: 2 };

function isWordsAccepted(accepted: Question['accepted']): accepted is AcceptedAnswer {
  return 'canonical' in accepted;
}

/**
 * Choose which of the recogniser's n-best alternatives to submit: a dry-run
 * match ranks them correct > almost > wrong, ties going to the earlier (more
 * confident) alternative. The dry run always forgives accents so a fully
 * accented alternative outranks its unaccented twin; the *real* grading later
 * still honours the learner's accept-without-accents setting.
 */
export function pickGiven(alternatives: string[], question: Question): string {
  const first = alternatives[0] ?? '';
  if (!isWordsAccepted(question.accepted)) return first;
  let best = first;
  let bestRank = -1;
  for (const alternative of alternatives) {
    const result = matchText(question.accepted, alternative, { acceptNoAccents: true });
    const rank = RANK[result.verdict];
    if (rank > bestRank) {
      bestRank = rank;
      best = alternative;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ *
 * Zones
 * ------------------------------------------------------------------ */

const LABEL_KEYS = [
  'common.check',
  'drill.hold_to_talk',
  'drill.release_hint',
  'drill.type_instead',
  'drill.type_placeholder',
  'drill.mic_denied',
  'drill.mic_denied_sub',
  'drill.mic_help_link',
  'toasts.no_speech',
  'toasts.offline',
] as const;

/** Which errors the learner can act on in place; the rest stay silent. */
const ERROR_LABEL: Partial<Record<RecognitionErrorKind, string>> = {
  'no-speech': 'toasts.no_speech',
  network: 'toasts.offline',
};

function SpeakPrompt({ question }: PromptProps) {
  const live = useSyncExternalStore(subscribeInterim, readInterim, readInterim);
  // A transcript belongs to exactly one question; anything else reads as blank,
  // so moving on can never leave the previous hypothesis on screen.
  const text = live.questionId === question.id ? live.text : '';

  return (
    <PromptStage>
      <NumeralPrompt payload={question.prompt} />
      <Transcript text={text} caret={text !== ''} />
    </PromptStage>
  );
}

function SpeakAnswer({
  question,
  services,
  verdict,
  onSubmit,
  micDenied,
  onMicDenied,
  onMicHelp,
  labels,
}: AnswerZoneProps) {
  const [mic, setMic] = useState<MicState>('idle');
  const [typing, setTyping] = useState(false);
  const [hintKey, setHintKey] = useState<string | null>(null);
  const [pending, setPending] = useState({ id: question.id });
  const sessionRef = useRef<RecognitionSession | null>(null);

  if (pending.id !== question.id) {
    setPending({ id: question.id });
    setMic('idle');
    setTyping(false);
    setHintKey(null);
  }

  const answered = verdict !== null;

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setMic('idle');
  }, []);

  const start = useCallback(() => {
    if (micDenied || answered) return;
    setHintKey(null);
    setInterim(question.id, '');
    setMic('holding');
    sessionRef.current = services.startRecognition({
      interim: (text) => setInterim(question.id, text),
      onFinal: (alternatives) => {
        setInterim(question.id, '');
        stop();
        onSubmit(pickGiven(alternatives, question));
      },
      onError: (kind) => {
        setInterim(question.id, '');
        stop();
        if (kind === 'denied') {
          onMicDenied();
          return;
        }
        setHintKey(ERROR_LABEL[kind] ?? null);
      },
    });
  }, [micDenied, answered, services, question, onSubmit, onMicDenied, stop]);

  // Never leave a recogniser running when the zone unmounts mid-hold.
  useEffect(() => stop, [stop]);

  if (micDenied || typing) {
    return (
      <div className="flex flex-col gap-3">
        {micDenied && (
          <VerdictBlock
            variant="muted"
            title={labelOf(labels, 'drill.mic_denied')}
            sub={labelOf(labels, 'drill.mic_denied_sub')}
          />
        )}
        <TypedAnswer
          questionId={question.id}
          mode="words"
          accentKeys
          placeholder={labelOf(labels, 'drill.type_placeholder')}
          submitLabel={labelOf(labels, 'common.check')}
          verdict={verdict}
          onSubmit={onSubmit}
        />
        {micDenied && onMicHelp !== undefined && !answered && (
          <Button type="button" variant="ghost" onClick={onMicHelp}>
            {labelOf(labels, 'drill.mic_help_link')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3.5 text-center">
      <MicButton
        state={mic}
        onHoldStart={start}
        onHoldEnd={stop}
        aria-label={labelOf(labels, 'drill.hold_to_talk')}
      />
      <div>
        <div className="font-extrabold text-body">{labelOf(labels, 'drill.hold_to_talk')}</div>
        <div className="font-semibold text-caption text-text-muted">
          {labelOf(labels, 'drill.release_hint')}
        </div>
      </div>
      {hintKey !== null && <VerdictBlock variant="muted" title={labelOf(labels, hintKey)} />}
      {!answered && (
        <Button type="button" variant="ghost" onClick={() => setTyping(true)}>
          {labelOf(labels, 'drill.type_instead')}
        </Button>
      )}
    </div>
  );
}

export const speakMode: LearningMode = {
  id: 'speak',
  titleKey: 'modes.speak.title',
  // No `modes.speak.example` string exists; the mode list shows the `sub` line.
  exampleKey: 'modes.speak.sub',
  requires: ['speech'],
  labelKeys: LABEL_KEYS,
  source: numberSource('speak', (value) => buildAccepted(numberToWords(value), [])),
  pickGiven,
  Prompt: SpeakPrompt,
  AnswerZone: SpeakAnswer,
};
