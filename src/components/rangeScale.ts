/**
 * Logarithmic scale math for the double-ended number RangeSlider.
 *
 * Pure, DOM-free, framework-free — unit-testable in isolation.
 *
 * The scale runs 0…1,000,000 across seven detents placed at EQUAL visual
 * spacing. Between two adjacent detents the position is linear in the fine
 * step, so each fine step occupies equal visual width. Because the value span
 * of each decade grows tenfold while its visual width stays constant, the
 * overall value↔position curve is piecewise-linear and log-ish.
 *
 * `valueToRatio` and `ratioToValue` are inverse on the discrete set of valid
 * fine-step values: for every valid stop `v`, `ratioToValue(valueToRatio(v))`
 * reproduces `v` (exactly after `snap`, within float epsilon before it).
 */

export const RANGE_MIN = 0;
export const RANGE_MAX = 1_000_000;

/** The seven detents, at equal visual spacing along the rail. */
export const DETENTS = [0, 10, 100, 1_000, 10_000, 100_000, 1_000_000] as const;

/** Number of equal-width segments between detents (6). */
export const SEGMENT_COUNT = DETENTS.length - 1;

interface Segment {
  /** Lower detent value (inclusive). */
  readonly lo: number;
  /** Upper detent value (inclusive). */
  readonly hi: number;
  /** Fine step used for snapping inside this segment. */
  readonly step: number;
}

/**
 * One entry per segment. Each `(hi - lo) / step` is an integer, so both
 * detents are themselves valid fine-step stops.
 */
export const SEGMENTS: readonly Segment[] = [
  { lo: 0, hi: 10, step: 1 },
  { lo: 10, hi: 100, step: 5 },
  { lo: 100, hi: 1_000, step: 50 },
  { lo: 1_000, hi: 10_000, step: 500 },
  { lo: 10_000, hi: 100_000, step: 5_000 },
  { lo: 100_000, hi: 1_000_000, step: 50_000 },
];

/** Safe indexed access that satisfies noUncheckedIndexedAccess. */
function segAt(index: number): Segment {
  const seg = SEGMENTS[index];
  if (!seg) throw new RangeError(`no segment at index ${index}`);
  return seg;
}

/** Clamp a value into the scale domain, mapping NaN to the low end. */
export function clampValue(value: number): number {
  if (Number.isNaN(value)) return RANGE_MIN;
  return Math.min(Math.max(value, RANGE_MIN), RANGE_MAX);
}

/** Clamp a ratio into [0, 1], mapping NaN to 0. */
export function clampRatio(ratio: number): number {
  if (Number.isNaN(ratio)) return 0;
  return Math.min(Math.max(ratio, 0), 1);
}

/** Lowest segment whose upper detent is >= value (detents map to the lower segment). */
function segmentForValue(value: number): number {
  for (let i = 0; i < SEGMENTS.length; i += 1) {
    if (value <= segAt(i).hi) return i;
  }
  return SEGMENTS.length - 1;
}

/** Segment used when stepping UP: the one with lo <= value < hi. */
function stepUpSegment(value: number): number {
  for (let i = 0; i < SEGMENTS.length; i += 1) {
    if (value < segAt(i).hi) return i;
  }
  return SEGMENTS.length - 1;
}

/** Segment used when stepping DOWN: the one with lo < value <= hi. */
function stepDownSegment(value: number): number {
  for (let i = SEGMENTS.length - 1; i >= 0; i -= 1) {
    if (value > segAt(i).lo) return i;
  }
  return 0;
}

/** Map a value (clamped to domain) to its rail position ratio in [0, 1]. */
export function valueToRatio(value: number): number {
  const v = clampValue(value);
  const i = segmentForValue(v);
  const seg = segAt(i);
  const t = (v - seg.lo) / (seg.hi - seg.lo);
  return (i + t) / SEGMENT_COUNT;
}

/** Map a rail ratio in [0, 1] to a (raw, unsnapped) value in the domain. */
export function ratioToValue(ratio: number): number {
  const r = clampRatio(ratio);
  const scaled = r * SEGMENT_COUNT;
  // Round away float dust so a detent ratio lands exactly on its segment edge
  // (e.g. 2/6 * 6 = 1.9999999998 would otherwise floor to the wrong segment).
  const rounded = Math.round(scaled * 1e9) / 1e9;
  const i = Math.min(Math.floor(rounded), SEGMENT_COUNT - 1);
  const seg = segAt(i);
  const local = rounded - i;
  return seg.lo + local * (seg.hi - seg.lo);
}

/** Snap a raw value to the nearest valid fine step within its segment. */
export function snap(value: number): number {
  const v = clampValue(value);
  const seg = segAt(segmentForValue(v));
  const steps = Math.round((v - seg.lo) / seg.step);
  const snapped = seg.lo + steps * seg.step;
  return Math.min(Math.max(snapped, seg.lo), seg.hi);
}

/** Fine step size that applies when stepping up from a value. */
export function stepAt(value: number): number {
  return segAt(stepUpSegment(clampValue(value))).step;
}

/** Smallest valid stop strictly greater than `value` (capped at RANGE_MAX). */
export function nextStop(value: number): number {
  const v = snap(value);
  if (v >= RANGE_MAX) return RANGE_MAX;
  const seg = segAt(stepUpSegment(v));
  return Math.min(v + seg.step, RANGE_MAX);
}

/** Largest valid stop strictly less than `value` (floored at RANGE_MIN). */
export function prevStop(value: number): number {
  const v = snap(value);
  if (v <= RANGE_MIN) return RANGE_MIN;
  const seg = segAt(stepDownSegment(v));
  return Math.max(v - seg.step, RANGE_MIN);
}

/** Smallest detent strictly greater than `value` (capped at RANGE_MAX). */
export function nextDetent(value: number): number {
  const v = clampValue(value);
  for (const d of DETENTS) {
    if (d > v) return d;
  }
  return RANGE_MAX;
}

/** Largest detent strictly less than `value` (floored at RANGE_MIN). */
export function prevDetent(value: number): number {
  const v = clampValue(value);
  for (let i = DETENTS.length - 1; i >= 0; i -= 1) {
    const d = DETENTS[i];
    if (d !== undefined && d < v) return d;
  }
  return RANGE_MIN;
}
