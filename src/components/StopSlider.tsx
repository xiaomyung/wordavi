import {
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  useRef,
  useState,
} from 'react';

export interface StopSliderProps {
  /** Ordered stop labels (e.g. slow / normal / fast). Two or more. */
  stops: readonly string[];
  /** Index of the active stop. Controlled — clamped into range for display. */
  index: number;
  /** Emitted with the new stop index when the thumb moves. */
  onChange: (index: number) => void;
  /** Accessible name for the thumb. */
  ariaLabel?: string;
  /** Disables interaction and removes the thumb from the tab order. */
  disabled?: boolean;
  className?: string;
}

const RAIL_STYLE: CSSProperties = {
  position: 'relative',
  height: 'var(--spacing-touch)',
  touchAction: 'none',
};

const TRACK_STYLE: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: '50%',
  transform: 'translateY(-50%)',
  height: 'calc(var(--radius-track) * 2)',
  borderRadius: 'var(--radius-track)',
};

const THUMB_HIT_STYLE: CSSProperties = {
  position: 'absolute',
  top: '50%',
  width: 'var(--spacing-touch)',
  height: 'var(--spacing-touch)',
  transform: 'translate(-50%, -50%)',
  touchAction: 'none',
  cursor: 'grab',
  background: 'transparent',
  border: 0,
  padding: 0,
};

const THUMB_CIRCLE_STYLE: CSSProperties = {
  width: 'var(--size-thumb)',
  height: 'var(--size-thumb)',
  borderRadius: '50%',
  background: 'var(--color-surface-raised)',
  border: '2px solid var(--color-accent)',
};

const THUMB_SHADOW = '0 2px 0 var(--color-border-strong)';
const THUMB_SHADOW_FOCUS = 'var(--shadow-focus), 0 2px 0 var(--color-border-strong)';

/** Pointer capture is best-effort — absent in some test DOMs. */
function capturePointer(el: Element, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* environment without pointer capture */
  }
}

function clampIndex(value: number, count: number): number {
  const rounded = Math.round(Number.isNaN(value) ? 0 : value);
  return Math.min(Math.max(rounded, 0), count - 1);
}

/**
 * Single-thumb slider snapping between labelled stops (used for speech rate).
 * Pointer + keyboard, no external dependencies. Pure and presentational.
 */
export function StopSlider({
  stops,
  index,
  onChange,
  ariaLabel,
  disabled = false,
  className,
}: StopSliderProps): ReactElement {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [focusVisible, setFocusVisible] = useState(false);

  const count = Math.max(stops.length, 1);
  const lastIndex = count - 1;
  const current = clampIndex(index, count);
  const ratio = lastIndex === 0 ? 0 : current / lastIndex;
  const label = stops[current] ?? '';

  function ratioFromClientX(clientX: number): number {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return 0;
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  }

  function commit(next: number): void {
    const clamped = clampIndex(next, count);
    if (clamped !== current) onChange(clamped);
  }

  function moveToClientX(clientX: number): void {
    commit(Math.round(ratioFromClientX(clientX) * lastIndex));
  }

  function onPointerDown(event: PointerEvent<HTMLElement>): void {
    if (disabled) return;
    draggingRef.current = true;
    capturePointer(event.currentTarget, event.pointerId);
    moveToClientX(event.clientX);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>): void {
    if (!draggingRef.current || disabled) return;
    moveToClientX(event.clientX);
  }

  function endDrag(event: PointerEvent<HTMLElement>): void {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* capture may already be gone */
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (disabled) return;
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = current + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = current - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = lastIndex;
        break;
      default:
        next = null;
    }
    if (next === null) return;
    event.preventDefault();
    commit(next);
  }

  function onFocus(event: FocusEvent<HTMLButtonElement>): void {
    try {
      setFocusVisible(event.target.matches(':focus-visible'));
    } catch {
      setFocusVisible(true);
    }
  }

  return (
    <div className={className} data-disabled={disabled || undefined}>
      <div
        ref={trackRef}
        style={{ ...RAIL_STYLE, opacity: disabled ? 0.6 : 1 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span
          aria-hidden="true"
          style={{ ...TRACK_STYLE, background: 'var(--color-surface-well)' }}
        />
        <span
          aria-hidden="true"
          style={{
            ...TRACK_STYLE,
            right: `${(1 - ratio) * 100}%`,
            background: 'var(--color-accent)',
          }}
        />
        <button
          type="button"
          role="slider"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={lastIndex}
          aria-valuenow={current}
          aria-valuetext={label}
          aria-label={ariaLabel}
          aria-disabled={disabled || undefined}
          tabIndex={disabled ? -1 : 0}
          data-thumb="stop"
          disabled={disabled}
          style={{ ...THUMB_HIT_STYLE, left: `${ratio * 100}%`, zIndex: 1 }}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={() => setFocusVisible(false)}
        >
          <span
            aria-hidden="true"
            style={{
              ...THUMB_CIRCLE_STYLE,
              boxShadow: focusVisible ? THUMB_SHADOW_FOCUS : THUMB_SHADOW,
            }}
          />
        </button>
      </div>
      <div
        aria-hidden="true"
        className="mt-1 flex justify-between font-mono text-tick font-semibold text-text-muted"
      >
        {stops.map((stop) => (
          <span key={stop}>{stop}</span>
        ))}
      </div>
    </div>
  );
}
