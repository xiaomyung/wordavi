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
  /**
   * Emitted once per interaction with the settled index: at the end of a drag,
   * when an arrow/Home/End key is released, or on blur if either ended without
   * its own event. Never fires when nothing moved. Use this for expensive work
   * (persistence, speech preview) and `onChange` for live visuals.
   */
  onChangeCommitted?: (index: number) => void;
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

/**
 * The 44px hit target is invisible scaffolding: no box, no ring, no native
 * chrome. `outline`/`boxShadow` are pinned here because the global
 * `:focus-visible` rule would otherwise paint a rectangular ring around this
 * square — the ring belongs to the round thumb below.
 */
const THUMB_HIT_STYLE: CSSProperties = {
  position: 'absolute',
  top: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'var(--spacing-touch)',
  height: 'var(--spacing-touch)',
  transform: 'translate(-50%, -50%)',
  touchAction: 'none',
  cursor: 'grab',
  appearance: 'none',
  background: 'transparent',
  border: 0,
  borderRadius: '50%',
  padding: 0,
  outline: 'none',
  boxShadow: 'none',
  WebkitTapHighlightColor: 'transparent',
};

const THUMB_CIRCLE_STYLE: CSSProperties = {
  flex: '0 0 auto',
  width: 'var(--size-thumb)',
  height: 'var(--size-thumb)',
  borderRadius: '50%',
  background: 'var(--color-surface-raised)',
  border: '2px solid var(--color-accent)',
};

const THUMB_SHADOW = '0 2px 0 var(--color-border-strong)';
const THUMB_SHADOW_FOCUS = 'var(--shadow-focus), 0 2px 0 var(--color-border-strong)';

/** Tick labels are absolute, so the row carries its own line-box height. */
const TICKS_STYLE: CSSProperties = { position: 'relative', height: '1.4em', lineHeight: 1.4 };

/** Rail position as a percentage string, trimmed of float dust. */
function percent(ratio: number): string {
  return `${Math.round(ratio * 1e4) / 1e2}%`;
}

/**
 * Stop labels share the thumb's coordinate system: the row spans exactly the
 * rail and label `i` of `n` is pinned to `i / (n - 1)` — the same ratio the
 * thumb uses. The two end labels hang inward so neither overflows the rail.
 */
function tickStyle(index: number, count: number): CSSProperties {
  const ratio = count > 1 ? index / (count - 1) : 0;
  let transform = 'translateX(-50%)';
  if (index === 0) transform = 'none';
  else if (index === count - 1) transform = 'translateX(-100%)';
  return { position: 'absolute', left: percent(ratio), transform, whiteSpace: 'nowrap' };
}

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
  onChangeCommitted,
  ariaLabel,
  disabled = false,
  className,
}: StopSliderProps): ReactElement {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  // Set by every emitted onChange, cleared by the once-per-interaction commit.
  const pendingRef = useRef(false);
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
    if (clamped === current) return;
    pendingRef.current = true;
    onChange(clamped);
  }

  /**
   * Settles the interaction: one `onChangeCommitted` with the index this
   * render was given, so callers can persist once instead of per stop.
   */
  function endInteraction(): void {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    onChangeCommitted?.(current);
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
    endInteraction();
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

  function onBlur(): void {
    setFocusVisible(false);
    // Safety net: a drag or key press that never got its end event.
    endInteraction();
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
            right: percent(1 - ratio),
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
          style={{ ...THUMB_HIT_STYLE, left: percent(ratio), zIndex: 1 }}
          onKeyDown={onKeyDown}
          onKeyUp={endInteraction}
          onFocus={onFocus}
          onBlur={onBlur}
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
        className="mt-1 font-mono text-tick font-semibold text-text-muted"
        style={TICKS_STYLE}
      >
        {stops.map((stop, index) => (
          <span key={stop} data-tick={index} style={tickStyle(index, stops.length)}>
            {stop}
          </span>
        ))}
      </div>
    </div>
  );
}
