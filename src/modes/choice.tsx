import { useMemo, useState } from 'react';
import { Button, ChoiceButton, type ChoiceState } from '@/components';
import { buildDistractors, createRng, formatNumber, shuffle } from '@/engine';
import type { Question } from '@/session';
import { numberSource } from './buckets';
import { PromptStage, promptSpanish, SpanishPhrase } from './prompt';
import type { AnswerZoneProps, LearningMode, PromptProps } from './types';
import { labelOf } from './types';

/**
 * choice — es-ES words → one of four numbers (drill-choice.html).
 *
 * ## Where the four options live
 *
 * They are NOT stored: `Question` has a closed payload union with no room for
 * mode-specific extras, and widening it would leak one mode's UI into the
 * session layer. Instead {@link choiceOptions} *derives* them as a pure
 * function of the question, seeded by `question.id` — so a re-render, a resumed
 * round and a wrongQueue replay all show the same four tiles in the same order.
 *
 * The distractor range is derived from the answer's magnitude (never the round
 * config, which is not part of the question) so the derivation stays pure: a
 * 3-digit answer draws distractors from 0 – 999. The engine's confusable-aware
 * `buildDistractors` still leads with 60/70, 5xx/7xx/9xx and teen/ten mix-ups.
 */

const OPTION_COUNT = 4;

const LABEL_KEYS = ['common.check', 'drill.choice_hint'] as const;

/**
 * The numeric answer of a choice question. Null for a payload that has no
 * single number to tile — the source only ever claims `{ kind: 'number' }`
 * questions (see its `canReplay`), so the tiles below are always four.
 */
export function answerValueOf(question: Question): number | null {
  return question.prompt.kind === 'number' ? question.prompt.value : null;
}

/** Distractor pool bound: the whole decade band of the answer, at least 0–99. */
function optionRange(answer: number): { min: number; max: number } {
  const digits = String(Math.abs(Math.trunc(answer))).length;
  return { min: 0, max: Math.max(99, 10 ** digits - 1) };
}

/** The four tiles, answer included, in stable display order. */
export function choiceOptions(question: Question): number[] {
  const answer = answerValueOf(question);
  if (answer === null) return [];
  const rng = createRng(`choice:${question.id}:${answer}`);
  const distractors = buildDistractors(answer, rng, optionRange(answer));
  return shuffle([answer, ...distractors], rng).slice(0, OPTION_COUNT);
}

function ChoicePrompt({ question, labels }: PromptProps) {
  return (
    <PromptStage>
      <SpanishPhrase text={promptSpanish(question.prompt)} />
      <p className="font-semibold text-label text-text-muted">
        {labelOf(labels, 'drill.choice_hint')}
      </p>
    </PromptStage>
  );
}

function ChoiceAnswer({ question, verdict, onSubmit, labels }: AnswerZoneProps) {
  const options = useMemo(() => choiceOptions(question), [question]);
  const answer = answerValueOf(question);
  const [pick, setPick] = useState<{ id: string; value: number | null }>({
    id: question.id,
    value: null,
  });
  if (pick.id !== question.id) setPick({ id: question.id, value: null });

  const answered = verdict !== null;
  const selected = pick.id === question.id ? pick.value : null;

  function stateOf(option: number): ChoiceState {
    if (answered) {
      if (option === answer) return 'revealedCorrect';
      return option === selected ? 'chosenWrong' : 'idle';
    }
    return option === selected ? 'selected' : 'idle';
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        {options.map((option) => (
          <ChoiceButton
            key={option}
            state={stateOf(option)}
            locked={answered}
            onClick={() => setPick({ id: question.id, value: option })}
          >
            {formatNumber(option)}
          </ChoiceButton>
        ))}
      </div>
      {!answered && (
        <Button
          type="button"
          disabled={selected === null}
          onClick={() => {
            if (selected !== null) onSubmit(String(selected));
          }}
        >
          {labelOf(labels, 'common.check')}
        </Button>
      )}
    </div>
  );
}

export const choiceMode: LearningMode = {
  id: 'choice',
  titleKey: 'modes.choice.title',
  // No `modes.choice.example` string exists; the mode list shows the `sub` line.
  exampleKey: 'modes.choice.sub',
  requires: [],
  labelKeys: LABEL_KEYS,
  source: numberSource('choice', (value) => ({ intVal: value })),
  Prompt: ChoicePrompt,
  AnswerZone: ChoiceAnswer,
};
