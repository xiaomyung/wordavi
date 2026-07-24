import { createRng, type Rng } from '@/engine';
import type { CountingRng } from './types';

/**
 * Wrap a seeded engine {@link Rng} so the round can count consumed draws.
 *
 * Determinism contract: every method of the engine's `Rng` (`next`, `int`,
 * `pick`, `weighted`) consumes exactly one underlying `next()` — and consumes it
 * only on success, since the throwing paths (`pick` on an empty array,
 * `weighted` with no positive weights) bail out before drawing. The counter is
 * therefore an exact stream position, so re-creating the generator from the same
 * seed and calling `next()` `skip` times lands on the very next value the
 * interrupted round would have seen.
 *
 * @param seed  round seed (same seed → same question sequence)
 * @param skip  draws already consumed before this round was serialized
 */
export function makeCountingRng(seed: number, skip: number): CountingRng {
  const base = createRng(seed);
  for (let i = 0; i < skip; i += 1) base.next();
  let draws = skip;

  const rng: Rng = {
    next: () => {
      const value = base.next();
      draws += 1;
      return value;
    },
    int: (lo, hi) => {
      const value = base.int(lo, hi);
      draws += 1;
      return value;
    },
    pick: (arr) => {
      const value = base.pick(arr);
      draws += 1;
      return value;
    },
    weighted: (items) => {
      const value = base.weighted(items);
      draws += 1;
      return value;
    },
  };

  return { rng, draws: () => draws };
}
