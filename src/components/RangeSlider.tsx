import {
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  useRef,
  useState,
} from 'react';
import {
  clampRatio,
  clampValue,
  nextDetent,
  nextStop,
  prevDetent,
  prevStop,
  RANGE_MAX,
  RANGE_MIN,
  ratioToValue,
  snap,
  valueToRatio,
} from './rangeScale';

type Thumb = 'lo' | 'hi';

interface DragState {
  readonly mode: Thumb | 'span';
  readonly startRatio: number;
  readonly startLo: number;
  readonly startHi: number;
}

export interface RangeSliderProps {
  /** Lower bound of the selectable range. Defaults to 0 (the scale floor). */
  min?: number;
  /** Upper bound of the selectable range. Defaults to 1,000,000 (scale ceiling). */
  max?: number;
  /** Current selection as `[lo, hi]`. Controlled — the component never self-mutates. */
  value: readonly [number, number];
  /** Emitted with the snapped `[lo, hi]` whenever either thumb moves. */
  onChange: (value: [number, number]) => void;
  /**
   * Emitted once per interaction with the settled `[lo, hi]`: at the end of a
   * drag, when an arrow/Page/Home/End key is released, or on blur if either
   * ended without its own event. Never fires when nothing moved. Use this for
   * expensive work (persistence, network) and `onChange` for live visuals.
   */
  onChangeCommitted?: (value: [number, number]) => void;
  /** Seven tick labels rendered under the rail (i18n resolved by the caller). */
  tickLabels: readonly string[];
  /** Formats a value for `aria-valuetext`. Defaults to `String`. */
  formatValue?: (value: number) => string;
  /** Accessible name for the lower thumb. */
  minThumbLabel?: string;
  /** Accessible name for the upper thumb. */
  maxThumbLabel?: string;
  /** Disables interaction and removes the thumbs from the tab order. */
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
 * Tick labels share the thumbs' coordinate system: the row spans exactly the
 * rail and every label is pinned to its detent ratio (detents sit at equal
 * visual spacing, so label `i` of `n` sits at `i / (n - 1)`). The two end
 * labels hang inward instead of centring, so neither overflows the rail.
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

/**
 * Double-ended logarithmic range slider over 0…1,000,000. Pointer + full
 * keyboard support, no external dependencies. Pure and presentational: it
 * renders `value` and reports intent through `onChange`.
 */
export function RangeSlider({
  min = RANGE_MIN,
  max = RANGE_MAX,
  value,
  onChange,
  onChangeCommitted,
  tickLabels,
  formatValue = String,
  minThumbLabel,
  maxThumbLabel,
  disabled = false,
  className,
}: RangeSliderProps): ReactElement {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  // Set by every emitted onChange, cleared by the once-per-interaction commit.
  const pendingRef = useRef(false);
  const [focusVisibleThumb, setFocusVisibleThumb] = useState<Thumb | null>(null);

  const bound = (v: number): number => Math.min(Math.max(clampValue(v), min), max);

  // Displayed values: snapped and de-crossed, without ever emitting from render.
  const rawLo = snap(bound(value[0]));
  const rawHi = snap(bound(value[1]));
  const lo = Math.min(rawLo, prevStop(rawHi));
  const hi = Math.max(rawHi, nextStop(rawLo));

  const loRatio = valueToRatio(lo);
  const hiRatio = valueToRatio(hi);

  function ratioFromClientX(clientX: number): number {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return 0;
    return clampRatio((clientX - rect.left) / rect.width);
  }

  function commit(nextLo: number, nextHi: number): void {
    const cLo = Math.min(Math.max(nextLo, min), prevStop(nextHi));
    const cHi = Math.max(Math.min(nextHi, max), nextStop(nextLo));
    if (cLo === lo && cHi === hi) return;
    pendingRef.current = true;
    onChange([cLo, cHi]);
  }

  /**
   * Settles the interaction: one `onChangeCommitted` with the values this
   * render was given, so callers can persist once instead of per stop.
   */
  function endInteraction(): void {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    onChangeCommitted?.([lo, hi]);
  }

  function moveLo(next: number): void {
    commit(Math.min(Math.max(next, min), prevStop(hi)), hi);
  }

  function moveHi(next: number): void {
    commit(lo, Math.max(Math.min(next, max), nextStop(lo)));
  }

  function handlePointerMove(clientX: number): void {
    const drag = dragRef.current;
    if (!drag || disabled) return;
    const ratio = ratioFromClientX(clientX);
    if (drag.mode === 'lo') {
      moveLo(snap(ratioToValue(ratio)));
    } else if (drag.mode === 'hi') {
      moveHi(snap(ratioToValue(ratio)));
    } else {
      const delta = ratio - drag.startRatio;
      let nLo = valueToRatio(drag.startLo) + delta;
      let nHi = valueToRatio(drag.startHi) + delta;
      if (nLo < 0) {
        nHi -= nLo;
        nLo = 0;
      }
      if (nHi > 1) {
        nLo -= nHi - 1;
        nHi = 1;
      }
      const newLo = snap(ratioToValue(clampRatio(nLo)));
      let newHi = snap(ratioToValue(clampRatio(nHi)));
      if (newHi <= newLo) newHi = nextStop(newLo);
      commit(newLo, newHi);
    }
  }

  function endDrag(event: PointerEvent<HTMLElement>): void {
    if (!dragRef.current) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* capture may already be gone */
    }
    dragRef.current = null;
    endInteraction();
  }

  function startThumbDrag(which: Thumb, event: PointerEvent<HTMLButtonElement>): void {
    if (disabled) return;
    event.stopPropagation();
    capturePointer(event.currentTarget, event.pointerId);
    dragRef.current = { mode: which, startRatio: 0, startLo: lo, startHi: hi };
  }

  function startSpanDrag(event: PointerEvent<HTMLSpanElement>): void {
    if (disabled) return;
    event.stopPropagation();
    capturePointer(event.currentTarget, event.pointerId);
    dragRef.current = {
      mode: 'span',
      startRatio: ratioFromClientX(event.clientX),
      startLo: lo,
      startHi: hi,
    };
  }

  function startRailDrag(event: PointerEvent<HTMLDivElement>): void {
    if (disabled) return;
    const clicked = ratioToValue(ratioFromClientX(event.clientX));
    // Nearest thumb grabs a bare-rail click, then keeps tracking the pointer.
    let target: Thumb;
    if (clicked <= lo) target = 'lo';
    else if (clicked >= hi) target = 'hi';
    else target = clicked - lo <= hi - clicked ? 'lo' : 'hi';
    capturePointer(event.currentTarget, event.pointerId);
    dragRef.current = { mode: target, startRatio: 0, startLo: lo, startHi: hi };
    handlePointerMove(event.clientX);
  }

  function keyStep(which: Thumb, current: number, key: string): number | null {
    switch (key) {
      case 'ArrowRight':
      case 'ArrowUp':
        return nextStop(current);
      case 'ArrowLeft':
      case 'ArrowDown':
        return prevStop(current);
      case 'PageUp':
        return nextDetent(current);
      case 'PageDown':
        return prevDetent(current);
      case 'Home':
        return which === 'lo' ? min : nextStop(lo);
      case 'End':
        return which === 'lo' ? prevStop(hi) : max;
      default:
        return null;
    }
  }

  function onThumbKeyDown(which: Thumb, event: KeyboardEvent<HTMLButtonElement>): void {
    if (disabled) return;
    const current = which === 'lo' ? lo : hi;
    const next = keyStep(which, current, event.key);
    if (next === null) return;
    event.preventDefault();
    if (which === 'lo') moveLo(next);
    else moveHi(next);
  }

  function onThumbFocus(which: Thumb, event: FocusEvent<HTMLButtonElement>): void {
    let visible = true;
    try {
      visible = event.target.matches(':focus-visible');
    } catch {
      visible = true;
    }
    if (visible) setFocusVisibleThumb(which);
  }

  function onThumbBlur(which: Thumb): void {
    setFocusVisibleThumb((prev) => (prev === which ? null : prev));
    // Safety net: a drag or key press that never got its end event.
    endInteraction();
  }

  function renderThumb(which: Thumb): ReactElement {
    const current = which === 'lo' ? lo : hi;
    const ratio = which === 'lo' ? loRatio : hiRatio;
    const focused = focusVisibleThumb === which;
    return (
      <button
        type="button"
        role="slider"
        aria-orientation="horizontal"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={current}
        aria-valuetext={formatValue(current)}
        aria-label={which === 'lo' ? minThumbLabel : maxThumbLabel}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        data-thumb={which}
        disabled={disabled}
        style={{ ...THUMB_HIT_STYLE, left: percent(ratio), zIndex: focused ? 2 : 1 }}
        onPointerDown={(event) => startThumbDrag(which, event)}
        onPointerMove={(event) => handlePointerMove(event.clientX)}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(event) => onThumbKeyDown(which, event)}
        onKeyUp={endInteraction}
        onFocus={(event) => onThumbFocus(which, event)}
        onBlur={() => onThumbBlur(which)}
      >
        <span
          aria-hidden="true"
          style={{ ...THUMB_CIRCLE_STYLE, boxShadow: focused ? THUMB_SHADOW_FOCUS : THUMB_SHADOW }}
        />
      </button>
    );
  }

  return (
    <div className={className} data-disabled={disabled || undefined}>
      <div
        ref={trackRef}
        style={{ ...RAIL_STYLE, opacity: disabled ? 0.6 : 1 }}
        onPointerDown={startRailDrag}
        onPointerMove={(event) => handlePointerMove(event.clientX)}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span
          aria-hidden="true"
          style={{ ...TRACK_STYLE, background: 'var(--color-surface-well)' }}
        />
        <span
          aria-hidden="true"
          data-slider-fill=""
          style={{
            ...TRACK_STYLE,
            left: percent(loRatio),
            right: percent(1 - hiRatio),
            background: 'var(--color-accent)',
            cursor: disabled ? 'default' : 'grab',
          }}
          onPointerDown={startSpanDrag}
          onPointerMove={(event) => handlePointerMove(event.clientX)}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
        {renderThumb('lo')}
        {renderThumb('hi')}
      </div>
      <div
        aria-hidden="true"
        className="numerals mt-1 font-mono text-tick font-semibold text-text-muted"
        style={TICKS_STYLE}
      >
        {tickLabels.map((label, index) => (
          <span key={label} data-tick={index} style={tickStyle(index, tickLabels.length)}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
