import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from './cx';
import { MicGlyph } from './glyphs';
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

/** Inline stamp size next to the verdict line (the field's own stamp is 26). */
const STAMP_PX = 22;

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
  // One decision drives both the tone and the icon: a verdict is shown only
  // when there is one and the caller has not asked for the neutral info line.
  const tone = variant === 'muted' ? undefined : verdict;

  return (
    <div
      className={cx(
        'wa-verdict',
        tone === undefined ? 'wa-verdict--muted' : VARIANT_CLASS[tone],
        className,
      )}
      role="status"
      {...rest}
    >
      <span className="wa-verdict-icon">
        {tone === undefined ? (
          (icon ?? <MicGlyph crossed />)
        ) : (
          <Stamp verdict={tone} size={STAMP_PX} />
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
