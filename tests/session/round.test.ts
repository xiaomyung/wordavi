import { describe, expect, it } from 'vitest';
import {
  answerQuestion,
  buildRetryRound,
  closeRound,
  createRound,
  deserializeRound,
  finishRound,
  initSrs,
  isRoundComplete,
  isRoundSerialized,
  nextQuestion,
  type Question,
  type QuestionSource,
  type RoundConfig,
  type RoundState,
  serializeRound,
} from '@/session';
import { correctAnswerFor, makeSequenceSource, makeStubSource, numberQuestion } from './helpers';

function cfg(overrides: Partial<RoundConfig> = {}): RoundConfig {
  return { modeId: 'm', size: 10, rangeMin: 0, rangeMax: 99, seed: 42, ...overrides };
}

function numberValue(q: Question): number {
  return q.prompt.kind === 'number' ? q.prompt.value : Number.NaN;
}

function current(state: RoundState): Question {
  const q = state.current;
  if (q === null) throw new Error('no current question');
  return q;
}

describe('round — fixed happy path', () => {
  it('runs a full 10-question round answered all correct', () => {
    let state = createRound(cfg({ size: 10 }), initSrs(), makeStubSource());
    for (let i = 0; i < 10; i += 1) {
      state = nextQuestion(state);
      expect(state.current).not.toBeNull();
      state = answerQuestion(state, correctAnswerFor(current(state))).state;
    }
    expect(isRoundComplete(state)).toBe(true);
    // nextQuestion is a no-op once complete
    expect(nextQuestion(state).served).toHaveLength(10);

    const summary = finishRound(state);
    expect(summary.total).toBe(10);
    expect(summary.correctCount).toBe(10);
    expect(summary.almostCount).toBe(0);
    expect(summary.wrongCount).toBe(0);
    expect(summary.accuracy).toBe(1);
    expect(summary.points).toBe(100);
    expect(summary.bestCombo).toBe(10);
    expect(summary.missed).toHaveLength(0);
  });

  it('supports sizes 10/20/30 and any retry-sized count', () => {
    for (const size of [10, 20, 30, 7] as const) {
      let state = createRound(cfg({ size }), initSrs(), makeStubSource());
      let served = 0;
      while (!isRoundComplete(state)) {
        state = nextQuestion(state);
        state = answerQuestion(state, correctAnswerFor(current(state))).state;
        served += 1;
      }
      expect(served).toBe(size);
      expect(finishRound(state).total).toBe(size);
    }
  });

  it('serves one question at a time — nextQuestion is idempotent while unanswered', () => {
    let state = createRound(cfg(), initSrs(), makeStubSource());
    state = nextQuestion(state);
    const first = current(state);
    state = nextQuestion(state);
    expect(state.current).toBe(first);
    expect(state.served).toHaveLength(1);
  });
});

describe('round — endless', () => {
  it('never auto-completes and finishes on demand with the same summary shape', () => {
    let state = createRound(cfg({ size: 'endless' }), initSrs(), makeStubSource());
    for (let i = 0; i < 5; i += 1) {
      state = nextQuestion(state);
      state = answerQuestion(state, correctAnswerFor(current(state))).state;
    }
    expect(isRoundComplete(state)).toBe(false);
    const summary = finishRound(state);
    expect(summary.size).toBe('endless');
    expect(summary.total).toBe(5);
    expect(summary.points).toBe(50);
  });

  it('closeRound ends an endless round so it cannot be resumed into', () => {
    let state = createRound(cfg({ size: 'endless' }), initSrs(), makeStubSource());
    state = nextQuestion(state);
    state = answerQuestion(state, correctAnswerFor(current(state))).state;

    const closed = closeRound(state);
    expect(closed.finished).toBe(true);
    expect(nextQuestion(closed).served).toHaveLength(1);
    expect(closeRound(closed)).toBe(closed); // idempotent
    expect(serializeRound(closed).finished).toBe(true);
  });
});

describe('round — verdict mapping (real engine)', () => {
  it('maps engine correct / almost / wrong to +10 / +8 / 0', () => {
    let state = createRound(cfg({ size: 10, seed: 1 }), initSrs(), makeSequenceSource([5, 23, 7]));

    state = nextQuestion(state);
    let out = answerQuestion(state, 'cinco');
    state = out.state;
    expect(out.record.verdict).toBe('correct');

    state = nextQuestion(state);
    out = answerQuestion(state, 'veintitres'); // accent dropped from "veintitrés"
    state = out.state;
    expect(out.record.verdict).toBe('almost');
    expect(out.record.noteKey).toBe('accent');

    state = nextQuestion(state);
    out = answerQuestion(state, 'zzz');
    state = out.state;
    expect(out.record.verdict).toBe('wrong');

    const summary = finishRound(state);
    expect(summary.correctCount).toBe(2); // correct + almost
    expect(summary.almostCount).toBe(1);
    expect(summary.wrongCount).toBe(1);
    expect(summary.points).toBe(18); // 10 + 8 + 0
    expect(summary.bestCombo).toBe(2); // almost kept the combo
    expect(summary.missed).toHaveLength(1);
    expect(numberValue(summary.missed[0] as Question)).toBe(7);
  });

  it('acceptNoAccents: false grades an accent miss as wrong', () => {
    let state = createRound(
      cfg({ seed: 1, acceptNoAccents: false }),
      initSrs(),
      makeSequenceSource([23]),
    );
    state = nextQuestion(state);
    expect(answerQuestion(state, 'veintitres').record.verdict).toBe('wrong');
    expect(answerQuestion(state, 'veintitrés').record.verdict).toBe('correct');
  });
});

describe('round — digit answers', () => {
  function digitSource(accepted: Question['accepted']): QuestionSource {
    return {
      eligibleBuckets: () => ['d0_15'],
      generate: (rng) => {
        rng.next();
        return { id: 'd1', bucket: 'd0_15', prompt: { kind: 'number', value: 1500 }, accepted };
      },
    };
  }

  it('grades whole numbers through the engine parser (spaces and dots group)', () => {
    let state = createRound(cfg({ seed: 2 }), initSrs(), digitSource({ intVal: 1500 }));
    state = nextQuestion(state);
    expect(answerQuestion(state, '1500').record.verdict).toBe('correct');
    expect(answerQuestion(state, '1 500').record.verdict).toBe('correct');
    expect(answerQuestion(state, '1.500').record.verdict).toBe('correct');
    expect(answerQuestion(state, 1500).record.verdict).toBe('correct');
    expect(answerQuestion(state, '1501').record.verdict).toBe('wrong');
    expect(answerQuestion(state, 'not-a-number').record.verdict).toBe('wrong');
  });

  it('grades decimals on value, not spelling — trailing zeros are insignificant', () => {
    let state = createRound(
      cfg({ seed: 2 }),
      initSrs(),
      digitSource({ intVal: 2, fracDigits: '50' }),
    );
    state = nextQuestion(state);
    expect(answerQuestion(state, '2,50').record.verdict).toBe('correct');
    expect(answerQuestion(state, '2,5').record.verdict).toBe('correct');
    expect(answerQuestion(state, 2.5).record.verdict).toBe('correct');
    expect(answerQuestion(state, '2,05').record.verdict).toBe('wrong');
    expect(answerQuestion(state, '2').record.verdict).toBe('wrong');
  });
});

describe('round — retry chain', () => {
  function roundWithTwoMisses(): { state: RoundState; config: RoundConfig } {
    const config = cfg({ size: 3, seed: 9 });
    let state = createRound(config, initSrs(), makeSequenceSource([5, 6, 7]));
    for (const answer of ['zzz', 'seis', 'zzz']) {
      state = nextQuestion(state);
      state = answerQuestion(state, answer).state;
    }
    return { state, config };
  }

  it('builds a retry round from wrong-only misses and clears when answered correctly', () => {
    const { state, config } = roundWithTwoMisses();
    const summary = finishRound(state);
    expect(summary.missed).toHaveLength(2);
    expect(summary.missed.map(numberValue).sort()).toEqual([5, 7]);

    let retry = buildRetryRound(summary, config, state.srs);
    expect(retry.retry).toBe(true);
    expect(retry.retryItems).toHaveLength(2);
    expect(retry.config.size).toBe(2); // sized to the miss list
    expect(retry.retryItems.every((q) => q.fromWrongQueue === true)).toBe(true);

    while (!isRoundComplete(retry)) {
      retry = nextQuestion(retry);
      retry = answerQuestion(retry, correctAnswerFor(current(retry))).state;
    }
    const retrySummary = finishRound(retry);
    expect(retrySummary.missed).toHaveLength(0);
    expect(retrySummary.size).toBe(2);
    expect(retrySummary.points).toBe(20); // full-fledged: a retry scores like any round
  });

  it('feeds the SRS from retry answers too', () => {
    const { state, config } = roundWithTwoMisses();
    const before = state.srs.answeredCount;
    let retry = buildRetryRound(finishRound(state), config, state.srs);
    retry = nextQuestion(retry);
    retry = answerQuestion(retry, correctAnswerFor(current(retry))).state;
    expect(retry.srs.answeredCount).toBe(before + 1);
  });

  it('chains until clean across multiple retry rounds', () => {
    const { state, config } = roundWithTwoMisses();
    const summary = finishRound(state);

    let retry = buildRetryRound(summary, config, state.srs);
    // miss the first retry item, get the second
    retry = nextQuestion(retry);
    retry = answerQuestion(retry, 'zzz').state;
    retry = nextQuestion(retry);
    retry = answerQuestion(retry, correctAnswerFor(current(retry))).state;
    const rsum1 = finishRound(retry);
    expect(rsum1.missed).toHaveLength(1);

    let retry2 = buildRetryRound(rsum1, retry.config, retry.srs);
    expect(retry2.retryItems).toHaveLength(1);
    expect(retry2.config.size).toBe(1);
    retry2 = nextQuestion(retry2);
    retry2 = answerQuestion(retry2, correctAnswerFor(current(retry2))).state;
    expect(finishRound(retry2).missed).toHaveLength(0);
  });
});

describe('round — wrongQueue ≤1 per 3 injection pacing', () => {
  it('never injects two wrongQueue items within 3 served questions', () => {
    const srs = initSrs();
    srs.answeredCount = 100;
    for (let i = 0; i < 5; i += 1) {
      srs.wrongQueue.push({
        question: numberQuestion(`wq${i}`, 3),
        reappearances: 0,
        consecutiveCorrect: 0,
        dueAt: 0,
      });
    }
    let state = createRound(cfg({ size: 12, seed: 5 }), srs, makeStubSource());
    const injectedSteps: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      state = nextQuestion(state);
      if (current(state).fromWrongQueue === true) injectedSteps.push(state.step);
      state = answerQuestion(state, correctAnswerFor(current(state))).state;
    }
    expect(injectedSteps.length).toBeGreaterThan(0);
    for (let i = 1; i < injectedSteps.length; i += 1) {
      expect(
        (injectedSteps[i] as number) - (injectedSteps[i - 1] as number),
      ).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('round — serialize / resume equivalence', () => {
  function runRound(serializeAfter: number | null): {
    trace: { value: number; verdict: string; fromQueue: boolean }[];
    points: number;
    missed: number[];
  } {
    const config = cfg({ size: 10, seed: 777 });
    let state = createRound(config, initSrs(), makeStubSource());
    const trace: { value: number; verdict: string; fromQueue: boolean }[] = [];
    for (let i = 0; i < 10; i += 1) {
      state = nextQuestion(state);
      const q = current(state);
      const given = numberValue(q) % 2 === 0 ? correctAnswerFor(q) : 'zzz';
      const out = answerQuestion(state, given);
      state = out.state;
      trace.push({
        value: numberValue(q),
        verdict: out.record.verdict,
        fromQueue: out.record.fromWrongQueue,
      });
      if (serializeAfter !== null && i === serializeAfter) {
        const raw: unknown = JSON.parse(JSON.stringify(serializeRound(state)));
        expect(isRoundSerialized(raw)).toBe(true);
        state = deserializeRound(
          raw as ReturnType<typeof serializeRound>,
          state.srs,
          makeStubSource(),
        );
      }
    }
    const summary = finishRound(state);
    return { trace, points: summary.points, missed: summary.missed.map(numberValue) };
  }

  it('resuming mid-round yields an identical continuation', () => {
    const control = runRound(null);
    const resumed = runRound(4);
    expect(resumed.trace).toEqual(control.trace);
    expect(resumed.points).toBe(control.points);
    expect(resumed.missed).toEqual(control.missed);
  });

  it('resuming with a question already served keeps it pending, unanswered', () => {
    let state = createRound(cfg({ seed: 3 }), initSrs(), makeStubSource());
    state = nextQuestion(state);
    const pending = current(state);
    const resumed = deserializeRound(serializeRound(state), state.srs, makeStubSource());
    expect(resumed.current).toEqual(pending);
    expect(resumed.records).toHaveLength(0);
    expect(nextQuestion(resumed).served).toHaveLength(1);
  });

  it('isRoundSerialized rejects foreign or corrupt payloads', () => {
    expect(isRoundSerialized(null)).toBe(false);
    expect(isRoundSerialized('garbage')).toBe(false);
    expect(isRoundSerialized({ version: 2 })).toBe(false);
    const good = serializeRound(createRound(cfg(), initSrs(), makeStubSource()));
    expect(isRoundSerialized(good)).toBe(true);
    expect(isRoundSerialized({ ...good, served: 'nope' })).toBe(false);
  });
});
