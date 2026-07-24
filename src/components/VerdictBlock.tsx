import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from './cx';
import { Stamp, type Verdict } from './Stamp';
import './answer-controls.css';

export interface VerdictBlockProps extends Omit<ComponentPropsWithRef<'div'>, 'title'> {
  /** Verdict line: "¡Muy bien!", "Почти — …", "Правильно: …". */
  title: ReactNode;
  /** Optional second line: the scoring/explanation note (a11y.md). */
  sub?: ReactNode;
  /**
   * Colour + circled stamp for a checked answer. Omit and pass `variant="muted"`
   * for a neutral info line (e.g. microphone unavailable).
   */
  verdict?: Verdict;
  /** `muted` renders a neutral, un-coloured info line with a ringed icon. */
  variant?: 'muted';
  /**
   * Icon for the muted variant. Defaults to a crossed-out microphone. Ignored
   * when a `verdict` is set (the stamp is used instead).
   */
  icon?: ReactNode;
}

const VARIANT_CLASS: Record<Verdict, string> = {
  correct: 'wa-verdict--correct',
  almost: 'wa-verdict--almost',
  wrong: 'wa-verdict--wrong',
};

function CrossedMicIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
      <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" />
      <path d="M4 4l16 16" strokeWidth="2.4" />
    </svg>
  );
}

/**
 * The verdict line under the answer zone. Enters with a fade + 6px rise
 * (--duration-text) delayed 80ms so it lands just after the field's stamp pop
 * (motion.md). Announced via `role="status"` so the outcome reaches assistive
 * tech in words, not colour (a11y.md).
 */
export function VerdictBlock({
  title,
  sub,
  verdict,
  variant,
  icon,
  className,
  ...rest
}: VerdictBlockProps) {
  const muted = variant === 'muted' || verdict === undefined;
  const toneClass = verdict !== undefined && !muted ? VARIANT_CLASS[verdict] : 'wa-verdict--muted';

  return (
    <div className={cx('wa-verdict', toneClass, className)} role="status" {...rest}>
      <span className="wa-verdict-icon">
        {verdict !== undefined && !muted ? (
          <Stamp verdict={verdict} size={22} />
        ) : (
          (icon ?? <CrossedMicIcon />)
        )}
      </span>
      <div>
        <div className="wa-verdict-title">{title}</div>
        {sub !== undefined && sub !== null && sub !== false ? (
          <div className="wa-verdict-sub">{sub}</div>
        ) : null}
      </div>
    </div>
  );
}
