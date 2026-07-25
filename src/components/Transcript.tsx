import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';
import './answer-controls.css';

export interface TranscriptProps extends ComponentPropsWithRef<'div'> {
  /** Interim speech text. When empty the line still reserves its height. */
  text: string;
  /** Show the blinking accent caret (default true). */
  caret?: boolean;
}

/**
 * Live interim transcript for speak mode (mic-button.md): display-font italic,
 * muted, with a 2px blinking accent caret. Rendered even while empty so the
 * layout never jumps when the first words arrive. `aria-live="polite"` lets the
 * running transcript reach assistive tech without interrupting.
 */
export function Transcript({ text, caret = true, className, ...rest }: TranscriptProps) {
  return (
    <div className={cx('wa-trans', className)} aria-live="polite" aria-atomic="true" {...rest}>
      {text}
      {caret && <span className="wa-caret" aria-hidden="true" />}
    </div>
  );
}
