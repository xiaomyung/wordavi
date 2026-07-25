import type { TFunction } from 'i18next';
import type { AnswerRecord } from '@/session';

export interface VerdictCopy {
  title: string;
  sub: string;
}

/**
 * Verdict wording (copy.md). Colour never carries the outcome alone: every
 * verdict spells it out, and a wrong one always names the right answer.
 * A wrong answer is never scolded — the sub line promises the number will
 * come back rather than counting the miss.
 */
export function verdictCopyOf(
  record: AnswerRecord,
  expectedDisplay: string,
  combo: number,
  t: TFunction,
): VerdictCopy {
  switch (record.verdict) {
    case 'correct': {
      const note = record.noteKey === undefined ? '' : ` · ${t(`notes.${record.noteKey}`)}`;
      return {
        title: t('verdict.correct'),
        sub: `${t('verdict.correct_sub', { n: combo })}${note}`,
      };
    }
    case 'almost':
      return {
        title: t('verdict.almost', { word: expectedDisplay }),
        sub: t('verdict.almost_sub'),
      };
    case 'wrong':
      return {
        title: t('verdict.wrong', { answer: expectedDisplay }),
        // No confusable-pair hint available yet: fall back to the encouraging
        // tail alone rather than interpolating an empty {{hint}}.
        sub: t('verdict.wrong_sub_plain'),
      };
  }
}
