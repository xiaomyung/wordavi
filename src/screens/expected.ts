import { formatNumber } from '@/engine';
import { isDigitTarget, type Question } from '@/session';

/**
 * The answer to reveal after a wrong verdict, in the form the learner was asked
 * to produce: Spanish words for spoken/written modes, an es-ES numeral for
 * digit-typed ones. Never shown before the answer is checked (a11y.md:
 * "Placeholders must never contain the expected answer").
 *
 * Shared by the drill (the reveal under a wrong answer) and the summary (the
 * correction line under a miss), so both print the same one answer.
 */
export function expectedDisplayOf(question: Question): string {
  const { accepted } = question;
  if (isDigitTarget(accepted)) {
    const int = formatNumber(accepted.intVal);
    return accepted.fracDigits === undefined ? int : `${int},${accepted.fracDigits}`;
  }
  return accepted.canonical;
}
