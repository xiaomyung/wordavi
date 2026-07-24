import { formatNumber } from '@/engine';
import type { AcceptedDigits, Question } from '@/session';

function isDigitTarget(accepted: Question['accepted']): accepted is AcceptedDigits {
  return typeof (accepted as AcceptedDigits).intVal === 'number';
}

/**
 * The answer to reveal after a wrong verdict, in the form the learner was asked
 * to produce: Spanish words for spoken/written modes, an es-ES numeral for
 * digit-typed ones. Never shown before the answer is checked (a11y.md:
 * "Placeholders must never contain the expected answer").
 */
export function expectedDisplayOf(question: Question): string {
  const { accepted } = question;
  if (isDigitTarget(accepted)) {
    const int = formatNumber(accepted.intVal);
    return accepted.fracDigits === undefined ? int : `${int},${accepted.fracDigits}`;
  }
  return accepted.canonical;
}
