import type { CSSProperties } from 'react';

/**
 * Geometry shared by the two sliders (`RangeSlider`, `StopSlider`).
 *
 * Both are the same physical object — a 44px rail, a 6px track, a 28px thumb in
 * an invisible 44px hit box, and a row of labels pinned under it. Only what the
 * rail *means* differs (a value span vs. one of n named stops), so the styles
 * and the two geometry helpers live here and the components keep only their
 * own interaction logic.
 */

export const RAIL_STYLE: CSSProperties = {
  position: 'relative',
  height: 'var(--spacing-touch)',
  touchAction: 'none',
};

export const TRACK_STYLE: CSSProperties = {
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
export const THUMB_HIT_STYLE: CSSProperties = {
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

export const THUMB_CIRCLE_STYLE: CSSProperties = {
  flex: '0 0 auto',
  width: 'var(--size-thumb)',
  height: 'var(--size-thumb)',
  borderRadius: '50%',
  background: 'var(--color-surface-raised)',
  border: '2px solid var(--color-accent)',
};

export const THUMB_SHADOW = '0 2px 0 var(--color-border-strong)';
export const THUMB_SHADOW_FOCUS = 'var(--shadow-focus), 0 2px 0 var(--color-border-strong)';

/** Labels are absolute, so the row carries its own line-box height. */
export const TICKS_STYLE: CSSProperties = {
  position: 'relative',
  height: '1.4em',
  lineHeight: 1.4,
};

/** Rail position as a percentage string, trimmed of float dust. */
export function percent(ratio: number): string {
  return `${Math.round(ratio * 1e4) / 1e2}%`;
}

/**
 * Labels share the thumbs' coordinate system: the row spans exactly the rail
 * and label `i` of `n` is pinned to `i / (n - 1)` — the ratio its detent/stop
 * sits at. The two end labels hang inward instead of centring, so neither
 * overflows the rail.
 */
export function tickStyle(index: number, count: number): CSSProperties {
  const ratio = count > 1 ? index / (count - 1) : 0;
  let transform = 'translateX(-50%)';
  if (index === 0) transform = 'none';
  else if (index === count - 1) transform = 'translateX(-100%)';
  return { position: 'absolute', left: percent(ratio), transform, whiteSpace: 'nowrap' };
}

/** Pointer capture is best-effort — absent in some test DOMs. */
export function capturePointer(el: Element, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* environment without pointer capture */
  }
}
