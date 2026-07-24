/**
 * Small seeded PRNG so drills are reproducible (e.g. Playwright `?seed=`).
 *
 * mulberry32 for the stream; a string seed is folded to a 32-bit integer with
 * an xmur3 step first. Same seed → same sequence, on every platform.
 */

/** A deterministic random source seeded by {@link createRng}. */
export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Integer in [lo, hi], inclusive both ends. */
  int(lo: number, hi: number): number;
  /** Uniformly pick one element; throws on an empty array. */
  pick<T>(arr: readonly T[]): T;
  /** Pick by weight; ignores non-positive weights; throws if none are positive. */
  weighted<T>(items: ReadonlyArray<readonly [T, number]>): T;
}

/** Fold a string to a well-mixed 32-bit seed (xmur3, single output word). */
function xmur3(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32: fast 32-bit PRNG returning floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Create a seeded {@link Rng} from a string or number seed. */
export function createRng(seed: string | number): Rng {
  const intSeed = typeof seed === 'number' ? seed >>> 0 : xmur3(seed);
  const next = mulberry32(intSeed);

  const rng: Rng = {
    next,
    int(lo, hi) {
      if (hi < lo) [lo, hi] = [hi, lo];
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    pick(arr) {
      if (arr.length === 0) throw new Error('rng.pick: empty array');
      return arr[Math.floor(next() * arr.length)] as (typeof arr)[number];
    },
    weighted(items) {
      let total = 0;
      for (const [, weight] of items) if (weight > 0) total += weight;
      if (total <= 0) throw new Error('rng.weighted: no positive weights');
      let roll = next() * total;
      for (const [value, weight] of items) {
        if (weight <= 0) continue;
        roll -= weight;
        if (roll < 0) return value;
      }
      // Floating-point fallthrough: return the last positively-weighted item.
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (item && item[1] > 0) return item[0];
      }
      throw new Error('rng.weighted: no positive weights');
    },
  };
  return rng;
}
