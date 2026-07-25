import { formatNumber } from '@/engine';
import { type Accepted, isDigitTarget, type Question } from '@/session';

/**
 * The answer to reveal after a wrong verdict, in the form the learner was asked
 * to produce: Spanish words for spoken/written modes, an es-ES numeral for
 * digit-typed ones. Never shown before the answer is checked (a11y.md:
 * "Placeholders must never contain the expected answer").
 *
 * Shared by the drill (the reveal under a wrong answer) and the summary (the
 * correction line under a miss), so both print the same one answer.
 *
 * Total for any payload: an `accepted` that carries no usable answer yields an
 * empty string, so a question that should never have got this far (a hand-edited
 * slot, a record from a build with another shape) costs the learner a blank
 * correction line rather than the whole drill.
 */
export function expectedDisplayOf(question: Question): string {
  const payload: unknown = question.accepted;
  if (typeof payload !== 'object' || payload === null) return '';
  const accepted = payload as Accepted;
  if (isDigitTarget(accepted)) {
    if (!Number.isFinite(accepted.intVal)) return '';
    const int = formatNumber(accepted.intVal);
    return typeof accepted.fracDigits === 'string' ? `${int},${accepted.fracDigits}` : int;
  }
  return typeof accepted.canonical === 'string' ? accepted.canonical : '';
}
