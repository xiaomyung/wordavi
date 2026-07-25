import { describe, expect, it } from 'vitest';
import { applyVerdict, initScore, type Score, type Verdict } from '@/session';

function run(verdicts: Verdict[]): Score {
  return verdicts.reduce(applyVerdict, initScore());
}

describe('score reducer', () => {
  it('starts at zero', () => {
    expect(initScore()).toEqual({ points: 0, combo: 0, bestCombo: 0 });
  });

  const cases: { name: string; verdicts: Verdict[]; expected: Score }[] = [
    {
      name: 'correct scores +10 and grows combo',
      verdicts: ['correct'],
      expected: { points: 10, combo: 1, bestCombo: 1 },
    },
    {
      name: 'almost scores +8 and keeps the combo alive',
      verdicts: ['correct', 'almost'],
      expected: { points: 18, combo: 2, bestCombo: 2 },
    },
    {
      name: 'wrong scores +0 and resets combo (bestCombo preserved)',
      verdicts: ['correct', 'correct', 'wrong'],
      expected: { points: 20, combo: 0, bestCombo: 2 },
    },
    {
      name: 'combo rebuilds after a wrong; bestCombo is the historical max',
      verdicts: ['correct', 'correct', 'correct', 'wrong', 'correct'],
      expected: { points: 40, combo: 1, bestCombo: 3 },
    },
    {
      name: 'mixed correct/almost run counts almost toward combo',
      verdicts: ['almost', 'correct', 'almost', 'correct'],
      expected: { points: 36, combo: 4, bestCombo: 4 },
    },
    {
      name: 'all wrong stays at zero',
      verdicts: ['wrong', 'wrong', 'wrong'],
      expected: { points: 0, combo: 0, bestCombo: 0 },
    },
  ];

  for (const { name, verdicts, expected } of cases) {
    it(name, () => {
      expect(run(verdicts)).toEqual(expected);
    });
  }

  it('no multiplier — points are a flat sum of per-verdict values', () => {
    const s = run(['correct', 'correct', 'correct', 'correct']);
    expect(s.points).toBe(40);
    expect(s.combo).toBe(4);
  });
});
