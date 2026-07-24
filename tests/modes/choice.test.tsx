import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { answerValueOf, choiceOptions, getMode } from '@/modes';
import type { Question } from '@/session';
import { generateFor, labelsFor, stubServices } from './helpers';

const choice = getMode('choice');
const labels = labelsFor(choice);

function question(value: number): Question {
  return {
    id: `choice:n${value}`,
    bucket: 'hundreds_irreg',
    prompt: { kind: 'number', value },
    accepted: { intVal: value },
  };
}

describe('choiceOptions', () => {
  it('is a pure function of the question — same tiles on every call', () => {
    const q = question(702);
    expect(choiceOptions(q)).toEqual(choiceOptions(q));
    expect(choiceOptions({ ...q })).toEqual(choiceOptions(q));
  });

  it('offers four distinct numbers including the answer', () => {
    for (const value of [0, 7, 16, 26, 60, 70, 90, 115, 500, 702, 914, 1500, 25_000]) {
      const options = choiceOptions(question(value));
      expect(options, String(value)).toHaveLength(4);
      expect(new Set(options).size).toBe(4);
      expect(options).toContain(value);
      expect(options.filter((option) => option !== value)).toHaveLength(3);
    }
  });

  it('keeps distractors non-negative integers', () => {
    for (const value of [0, 1, 5, 999]) {
      for (const option of choiceOptions(question(value))) {
        expect(Number.isInteger(option)).toBe(true);
        expect(option).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('leads with a confusable when the answer has one', () => {
    // 700 → the quinientos/setecientos/novecientos family.
    expect(choiceOptions(question(700)).some((option) => [500, 900].includes(option))).toBe(true);
    // 60 → sesenta/setenta.
    expect(choiceOptions(question(60))).toContain(70);
  });

  it('varies the tiles between different questions', () => {
    expect(choiceOptions(question(702))).not.toEqual(choiceOptions(question(703)));
  });

  it('reads the answer from a generated question', () => {
    const generated = generateFor(choice, 'twenties_fused', 4);
    expect(choiceOptions(generated)).toContain(answerValueOf(generated));
  });

  it('falls back to expectedDisplay for a foreign payload', () => {
    const foreign: Question = {
      id: 'grocery:q1500',
      bucket: 'qty_fractions',
      prompt: { kind: 'quantity', grams: 1500 },
      accepted: { intVal: 1500 },
    };
    expect(answerValueOf(foreign, '1500')).toBe(1500);
    expect(choiceOptions(foreign, '1500')).toContain(1500);
    expect(choiceOptions(foreign)).toEqual([]);
  });
});

describe('choice zones', () => {
  const services = stubServices();

  it('renders the Spanish phrase and the pick hint', () => {
    render(
      <choice.Prompt
        question={question(702)}
        services={services}
        slower={false}
        onToggleSlower={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.getByTestId('spanish-phrase')).toHaveTextContent('setecientos dos');
    expect(screen.getByText('Выберите число')).toBeInTheDocument();
  });

  it('submits the chosen number after a select-then-check', () => {
    const onSubmit = vi.fn();
    render(
      <choice.AnswerZone
        question={question(702)}
        services={services}
        verdict={null}
        expectedDisplay="702"
        onSubmit={onSubmit}
        micDenied={false}
        onMicDenied={vi.fn()}
        labels={labels}
      />,
    );
    const check = screen.getByRole('button', { name: 'Проверить' });
    expect(check).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '702' }));
    fireEvent.click(check);
    expect(onSubmit).toHaveBeenCalledWith('702');
  });

  it('reveals the correct tile and marks the wrong pick once graded', () => {
    const q = question(702);
    const options = choiceOptions(q);
    const wrong = options.find((option) => option !== 702) as number;
    const { rerender } = render(
      <choice.AnswerZone
        question={q}
        services={services}
        verdict={null}
        expectedDisplay="702"
        onSubmit={vi.fn()}
        micDenied={false}
        onMicDenied={vi.fn()}
        labels={labels}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: String(wrong) }));
    rerender(
      <choice.AnswerZone
        question={q}
        services={services}
        verdict="wrong"
        expectedDisplay="702"
        onSubmit={vi.fn()}
        micDenied={false}
        onMicDenied={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.getByRole('button', { name: /702/ })).toHaveClass('border-correct');
    expect(screen.getByRole('button', { name: new RegExp(String(wrong)) })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.queryByRole('button', { name: 'Проверить' })).toBeNull();
  });

  it('clears the selection when the drill moves on', () => {
    const { rerender } = render(
      <choice.AnswerZone
        question={question(702)}
        services={services}
        verdict={null}
        expectedDisplay="702"
        onSubmit={vi.fn()}
        micDenied={false}
        onMicDenied={vi.fn()}
        labels={labels}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '702' }));
    expect(screen.getByRole('button', { name: 'Проверить' })).toBeEnabled();
    rerender(
      <choice.AnswerZone
        question={question(26)}
        services={services}
        verdict={null}
        expectedDisplay="26"
        onSubmit={vi.fn()}
        micDenied={false}
        onMicDenied={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.getByRole('button', { name: 'Проверить' })).toBeDisabled();
  });
});
