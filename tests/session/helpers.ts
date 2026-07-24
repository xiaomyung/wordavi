import { type AcceptedAnswer, buildAccepted, numberToWords, type Rng } from '@/engine';
import { classifyNumber, type Question, type QuestionSource } from '@/session';

/**
 * Session tests run against the REAL engine — no matcher/rng double. The helpers
 * below only build questions the way a mode would, so the round is graded by
 * `matchText` and driven by the engine's seeded rng exactly as in production.
 */

/** The canonical spoken answer that grades the given question as 'correct'. */
export function correctAnswerFor(q: Question): string {
  return (q.accepted as AcceptedAnswer).canonical;
}

/**
 * An {@link Rng} pinned to one value, for asserting weighted-draw bands.
 * `int`/`pick`/`weighted` mirror the engine's arithmetic over that constant.
 */
export function constRng(value: number): Rng {
  return {
    next: () => value,
    int: (lo, hi) => lo + Math.floor(value * (hi - lo + 1)),
    pick: <T>(arr: readonly T[]): T => {
      if (arr.length === 0) throw new Error('constRng.pick: empty array');
      return arr[Math.floor(value * arr.length)] as T;
    },
    weighted: <T>(items: ReadonlyArray<readonly [T, number]>): T => {
      let total = 0;
      for (const [, weight] of items) if (weight > 0) total += weight;
      if (total <= 0) throw new Error('constRng.weighted: no positive weights');
      let roll = value * total;
      for (const [item, weight] of items) {
        if (weight <= 0) continue;
        roll -= weight;
        if (roll < 0) return item;
      }
      return (items.at(-1) as readonly [T, number])[0];
    },
  };
}

/** Build a number question with the engine's own accepted-answer set. */
export function numberQuestion(id: string, value: number): Question {
  return {
    id,
    bucket: classifyNumber(value),
    prompt: { kind: 'number', value },
    accepted: buildAccepted(numberToWords(value), []),
  };
}

/**
 * Stateless random source: draws the value and the id from the provided rng, so
 * runs are fully reproducible from the seed (needed for resume-equivalence tests).
 */
export function makeStubSource(): QuestionSource {
  return {
    eligibleBuckets: () => ['d0_15', 'teens_fused', 'twenties_fused', 'tens_y', 'tens_round'],
    generate: (rng) => numberQuestion(`q${rng.int(0, 1e9)}`, rng.int(0, 99)),
  };
}

/** Fixed-sequence source (stateful) for tests that need exact questions. */
export function makeSequenceSource(values: readonly number[]): QuestionSource {
  let i = 0;
  return {
    eligibleBuckets: () => ['d0_15'],
    generate: (rng) => {
      const value = values[i % values.length] as number;
      i += 1;
      rng.next(); // keep the draw count parallel to a real generating source
      return numberQuestion(`seq${i}`, value);
    },
  };
}
