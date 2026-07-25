import { slog } from './log';
import type { Score, Verdict } from './types';

export const POINTS: Record<Verdict, number> = {
  correct: 10,
  almost: 8,
  wrong: 0,
};

export function initScore(): Score {
  return { points: 0, combo: 0, bestCombo: 0 };
}

/**
 * Reducer: fold a verdict into the running score.
 * - correct: +10, combo +1
 * - almost:  +8,  combo +1 (accent miss keeps the combo)
 * - wrong:   +0,  combo -> 0 (bestCombo preserved)
 */
export function applyVerdict(score: Score, verdict: Verdict): Score {
  if (verdict === 'wrong') {
    slog('debug', 'score.reset', { combo: score.combo });
    return { points: score.points, combo: 0, bestCombo: score.bestCombo };
  }
  const combo = score.combo + 1;
  const next: Score = {
    points: score.points + POINTS[verdict],
    combo,
    bestCombo: Math.max(score.bestCombo, combo),
  };
  slog('debug', 'score.gain', { verdict, points: next.points, combo });
  return next;
}
