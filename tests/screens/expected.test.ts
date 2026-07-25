import { describe, expect, it } from 'vitest';
import { THIN_SPACE } from '@/engine';
import { expectedDisplayOf } from '@/screens/expected';
import type { Accepted, Question } from '@/session';

/** A question built around one `accepted` payload — the only field read here. */
function questionWith(accepted: unknown): Question {
  return {
    id: 'q1',
    bucket: 'd0_15',
    prompt: { kind: 'number', value: 7 },
    accepted: accepted as Accepted,
  };
}

describe('expectedDisplayOf', () => {
  it('prints a spoken answer in its canonical Spanish form', () => {
    const accepted = { canonical: 'dos con treinta y cinco', variants: [] };
    expect(expectedDisplayOf(questionWith(accepted))).toBe('dos con treinta y cinco');
  });

  it('prints a digit answer as an es-ES numeral', () => {
    expect(expectedDisplayOf(questionWith({ intVal: 1_234_567 }))).toBe(
      `1${THIN_SPACE}234${THIN_SPACE}567`,
    );
  });

  it('keeps the fractional digits as written, so 2,05 is not read as 2,5', () => {
    expect(expectedDisplayOf(questionWith({ intVal: 2, fracDigits: '05' }))).toBe('2,05');
  });

  /**
   * The shape guards keep malformed payloads out of the round, but a blank
   * correction line is the only acceptable failure here: this string is rendered
   * inside a running drill, and a throw would take the whole round to the crash
   * screen over one unreadable record.
   */
  describe('a payload with no usable answer', () => {
    it('degrades to blank when the answer set is missing entirely', () => {
      expect(expectedDisplayOf(questionWith(undefined))).toBe('');
      expect(expectedDisplayOf(questionWith(null))).toBe('');
      expect(expectedDisplayOf(questionWith('dos'))).toBe('');
    });

    it('degrades to blank when neither branch of the answer is present', () => {
      expect(expectedDisplayOf(questionWith({}))).toBe('');
      expect(expectedDisplayOf(questionWith({ variants: [{ text: 'dos' }] }))).toBe('');
    });

    it('degrades to blank rather than printing a non-number as digits', () => {
      expect(expectedDisplayOf(questionWith({ intVal: Number.NaN }))).toBe('');
      expect(expectedDisplayOf(questionWith({ intVal: Number.POSITIVE_INFINITY }))).toBe('');
    });

    it('drops a fractional part that is not a digit string', () => {
      expect(expectedDisplayOf(questionWith({ intVal: 2, fracDigits: 5 }))).toBe('2');
    });
  });
});
