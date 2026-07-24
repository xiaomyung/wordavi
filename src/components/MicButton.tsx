import type { KeyboardEvent, PointerEvent, Ref } from 'react';
import { useRef } from 'react';
import { cx } from './cx';
import './answer-controls.css';

export type MicState = 'idle' | 'holding' | 'denied';

export interface MicButtonProps {
  /** Visual + interaction state. `denied` is inert (crossed, muted). */
  state: MicState;
  /** Hold begins (pointer press or Space/Enter keydown). */
  onHoldStart?: () => void;
  /** Hold ends (pointer release/cancel or Space/Enter keyup). */
  onHoldEnd?: () => void;
  /** Accessible name, e.g. "Держите и говорите" (mic-button.md). */
  'aria-label': string;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
}

const HOLD_KEYS = new Set([' ', 'Spacebar', 'Enter']);

function MicGlyph({ crossed }: { crossed: boolean }) {
  return (
    <svg
      width="38"
      height="38"
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
      {crossed && <path d="M4 4l16 16" strokeWidth="2.4" />}
    </svg>
  );
}

/**
 * Press-and-hold "speak" button (mic-button.md). Purely presentational: it
 * receives its state via props and emits hold callbacks — it touches no
 * SpeechRecognition or media APIs (services wire those later). Holding shows
 * the two pulsing rings (the app's only looping animation). Works with a
 * pointer (with capture) and the keyboard (Space/Enter, repeat-guarded).
 */
export function MicButton({
  state,
  onHoldStart,
  onHoldEnd,
  className,
  ref,
  ...rest
}: MicButtonProps) {
  const holding = useRef(false);
  const denied = state === 'denied';

  function begin() {
    if (denied || holding.current) return;
    holding.current = true;
    onHoldStart?.();
  }

  function end() {
    if (!holding.current) return;
    holding.current = false;
    onHoldEnd?.();
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (denied) return;
    // Capture so a release outside the button still ends the hold. Guarded:
    // an invalid/absent pointer id can throw.
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      /* no-op */
    }
    begin();
  }

  function handlePointerEnd(event: PointerEvent<HTMLButtonElement>) {
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      /* no-op */
    }
    end();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!HOLD_KEYS.has(event.key)) return;
    event.preventDefault();
    // repeat-guard: the browser fires keydown continuously while held.
    if (event.repeat) return;
    begin();
  }

  function handleKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (!HOLD_KEYS.has(event.key)) return;
    event.preventDefault();
    end();
  }

  return (
    <span className={cx('wa-mic-wrap', className)}>
      {state === 'holding' && (
        <>
          <span className="wa-mic-ring" aria-hidden="true" />
          <span className="wa-mic-ring wa-mic-ring--delayed" aria-hidden="true" />
        </>
      )}
      <button
        ref={ref}
        type="button"
        className="wa-mic"
        data-state={state}
        aria-pressed={state === 'holding'}
        aria-label={rest['aria-label']}
        disabled={denied}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
      >
        <MicGlyph crossed={denied} />
      </button>
    </span>
  );
}
