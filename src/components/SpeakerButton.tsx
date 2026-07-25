import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';
import './answer-controls.css';

export interface SpeakerButtonProps extends ComponentPropsWithRef<'button'> {
  /** Playing: the glyph gains two static sound arcs (no loop animation). */
  playing?: boolean;
  /** Accessible name, e.g. "Прослушать ещё раз" (speaker-button.md). */
  'aria-label': string;
}

/**
 * Primary listen/replay button (speaker-button.md): 96px accent circle with a
 * shelf shadow and press physics. `playing` reveals two static arcs — never an
 * animation. `type="button"` by default; all native button props pass through.
 */
export function SpeakerButton({ playing = false, className, type, ...rest }: SpeakerButtonProps) {
  return (
    <button type={type ?? 'button'} className={cx('wa-speaker', className)} {...rest}>
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4z" fill="currentColor" />
        {playing && (
          <g
            className="wa-speaker-arcs"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M15.5 8.5a5 5 0 010 7" />
            <path d="M17.8 6.2a8.2 8.2 0 010 11.6" />
          </g>
        )}
      </svg>
    </button>
  );
}
