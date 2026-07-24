import type { NumberRange } from './generators';
import type { Rng } from './rng';

/**
 * Distractor generation for multiple-choice number questions.
 *
 * The pool is confusable-aware: es-ES learners mix up 60/70 (sesenta/setenta),
 * 500/700/900, and teens vs. tens (15/50, quince/cincuenta). Those "primary"
 * confusables are offered first; generic near-misses (±1, ×10/÷10, digit
 * transposition) fill in behind them, with a plain ±2..9 fallback last.
 */

function unique(values: number[]): number[] {
  return [...new Set(values)];
}

/** Swap any 6↔7 digit (sesenta/setenta family): 60 → 70, 76 → 66 & 77. */
function swapSixSeven(n: number): number[] {
  const s = String(n);
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '6') out.push(Number(`${s.slice(0, i)}7${s.slice(i + 1)}`));
    else if (s[i] === '7') out.push(Number(`${s.slice(0, i)}6${s.slice(i + 1)}`));
  }
  return out;
}

/** Teen ↔ tens confusions: 13↔30, 15↔50, 19↔90. */
function teenTensSwap(n: number): number[] {
  const out: number[] = [];
  if (n >= 13 && n <= 19) out.push((n - 10) * 10);
  if (n >= 30 && n <= 90 && n % 10 === 0) out.push(n / 10 + 10);
  return out;
}

/** Hundreds-digit swaps among 5/7/9 (quinientos/setecientos/novecientos). */
function hundredsSwap(n: number): number[] {
  const s = String(n);
  if (s.length < 3) return [];
  const idx = s.length - 3;
  const digit = s[idx];
  if (digit !== '5' && digit !== '7' && digit !== '9') return [];
  return ['5', '7', '9']
    .filter((alt) => alt !== digit)
    .map((alt) => Number(`${s.slice(0, idx)}${alt}${s.slice(idx + 1)}`));
}

/** Swap the last two digits — a unit landing in the wrong place. */
function transposeLastTwo(n: number): number[] {
  const s = String(n);
  if (s.length < 2) return [];
  const swapped = Number(`${s.slice(0, -2)}${s[s.length - 1]}${s[s.length - 2]}`);
  return swapped === n ? [] : [swapped];
}

/**
 * The high-plausibility "primary" confusables of `answer` (tens/6-7/hundreds
 * swaps). Exported so callers/tests can reason about the confusable pool.
 */
export function confusablesOf(answer: number): number[] {
  return unique([...teenTensSwap(answer), ...swapSixSeven(answer), ...hundredsSwap(answer)]);
}

function shuffle<T>(values: readonly T[], rng: Rng): T[] {
  const out = values.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/**
 * Build up to three distinct distractors for `answer`, all ≠ answer and inside
 * [min, max] when feasible. Primary confusables are drawn first (so at least
 * one is present whenever the answer has any), then generic near-misses, then a
 * ±2..9 fallback; a final out-of-range widen covers pathologically tiny ranges.
 */
export function buildDistractors(answer: number, rng: Rng, range: NumberRange): number[] {
  const { min, max } = range;
  const inRange = (v: number): boolean => v >= min && v <= max;
  const usable = (v: number): boolean => Number.isInteger(v) && v >= 0 && v !== answer;

  const primary = confusablesOf(answer);
  const secondary = unique([
    answer + 1,
    answer - 1,
    answer * 10,
    Math.floor(answer / 10),
    ...transposeLastTwo(answer),
  ]);

  const result: number[] = [];
  const add = (v: number): void => {
    if (usable(v) && !result.includes(v) && result.length < 3) result.push(v);
  };

  for (const v of shuffle(primary.filter(inRange), rng)) add(v);
  for (const v of shuffle(secondary.filter(inRange), rng)) add(v);

  if (result.length < 3) {
    const near: number[] = [];
    for (let k = 2; k <= 9; k++) near.push(answer + k, answer - k);
    for (const v of shuffle(near.filter(inRange), rng)) add(v);
  }
  // Last resort for tiny ranges: widen without the range constraint.
  for (let k = 2; result.length < 3 && k <= 50; k++) {
    add(answer + k);
    add(answer - k);
  }
  return result;
}
