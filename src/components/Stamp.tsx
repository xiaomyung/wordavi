import type { SVGProps } from 'react';
import { cx } from './cx';
import './answer-controls.css';

/**
 * The three verdict outcomes shared across the answer-input family. `almost`
 * marks an answer that is right apart from a missing accent (motion.md /
 * a11y.md); it never means "wrong".
 */
export type Verdict = 'correct' | 'almost' | 'wrong';

export interface StampProps extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Which circled glyph to draw: check, tilde-equals (≈), or cross. */
  verdict: Verdict;
  /** Diameter in px. 26 (default) inside a field; 22 inline in a verdict line. */
  size?: number;
  /** Play the pop keyframes once on mount (scale .6→1.1→1, rotate −16°→−8°). */
  animate?: boolean;
}

const VERDICT_CLASS: Record<Verdict, string> = {
  correct: 'wa-stamp--correct',
  almost: 'wa-stamp--almost',
  wrong: 'wa-stamp--wrong',
};

/**
 * Circled verdict glyph. Colour and rotation carry no meaning on their own —
 * this is decorative and always `aria-hidden`; the accompanying verdict line
 * (VerdictBlock) spells the outcome out in words (a11y.md).
 *
 * The ring is a non-scaling 2px stroke so it stays crisp at any `size`.
 */
export function Stamp({ verdict, size = 26, animate = false, className, ...rest }: StampProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      data-verdict={verdict}
      data-animate={animate ? 'true' : undefined}
      className={cx('wa-stamp', VERDICT_CLASS[verdict], className)}
      {...rest}
    >
      <circle
        cx="12"
        cy="12"
        r="10.5"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      {verdict === 'correct' && (
        <path
          d="M4 12.5l5.5 5.5L20 7"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {verdict === 'almost' && (
        <>
          <path
            d="M6 10q3 -3 6 0t6 0"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6 14.6q3 -3 6 0t6 0"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {verdict === 'wrong' && (
        <path
          d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
