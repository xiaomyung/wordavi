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
  type RoundSummary,
  type SrsState,
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

describe('round — wrongQueue is replayed only into a round that can grade it', () => {
  /** A source that owns one id prefix, the way every real mode's does. */
  function ownedSource(prefix: string): QuestionSource {
    let n = 0;
    return {
      eligibleBuckets: () => ['d0_15'],
      generate: (rng) => {
        rng.next();
        n += 1;
        return numberQuestion(`${prefix}:fresh${n}`, 5);
      },
      canReplay: (question) => question.id.startsWith(`${prefix}:`),
    };
  }

  function srsWithQueue(ids: readonly string[]): SrsState {
    const srs = initSrs();
    srs.answeredCount = 100;
    for (const id of ids) {
      srs.wrongQueue.push({
        question: numberQuestion(id, 3),
        reappearances: 0,
        consecutiveCorrect: 0,
        dueAt: 0,
      });
    }
    return srs;
  }

  it('never serves another mode’s miss, and generates instead of stalling', () => {
    const srs = srsWithQueue(['digits:n475', 'grocery:p2.35']);
    let state = createRound(cfg({ size: 6, seed: 5 }), srs, ownedSource('words'));
    for (let i = 0; i < 6; i += 1) {
      state = nextQuestion(state);
      const q = current(state);
      expect(q.id.startsWith('words:')).toBe(true);
      expect(q.fromWrongQueue).toBeUndefined();
      state = answerQuestion(state, correctAnswerFor(q)).state;
    }
    expect(state.records).toHaveLength(6);
  });

  it('still serves its own misses, so a learner can retire them', () => {
    const srs = srsWithQueue(['digits:n475', 'words:n700']);
    let state = createRound(cfg({ size: 6, seed: 5 }), srs, ownedSource('words'));
    const injected: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      state = nextQuestion(state);
      const q = current(state);
      if (q.fromWrongQueue === true) injected.push(q.id);
      state = answerQuestion(state, correctAnswerFor(q)).state;
    }
    expect(injected).toContain('words:n700');
    expect(injected.every((id) => id.startsWith('words:'))).toBe(true);
  });

  it('retires an own-mode item after two correct answers instead of looping', () => {
    const srs = srsWithQueue(['words:n700']);
    let state = createRound(cfg({ size: 10, seed: 5 }), srs, ownedSource('words'));
    for (let i = 0; i < 10; i += 1) {
      state = nextQuestion(state);
      state = answerQuestion(state, correctAnswerFor(current(state))).state;
    }
    expect(state.srs.wrongQueue).toHaveLength(0);
  });
});

describe('round — resuming a question the mode cannot serve', () => {
  const foreign = numberQuestion('grocery:q1500', 1500);

  function ownedSource(prefix: string): QuestionSource {
    return {
      eligibleBuckets: () => ['d0_15'],
      generate: (rng) => numberQuestion(`${prefix}:n${rng.int(0, 99)}`, 5),
      canReplay: (question) => question.id.startsWith(`${prefix}:`),
    };
  }

  /** A parked round whose pending question was minted by another mode. */
  function parked(records: number): ReturnType<typeof serializeRound> {
    let state = createRound(cfg({ size: 5, seed: 11 }), initSrs(), ownedSource('choice'));
    for (let i = 0; i < records; i += 1) {
      state = nextQuestion(state);
      state = answerQuestion(state, correctAnswerFor(current(state))).state;
    }
    const serialized = serializeRound(state);
    return {
      ...serialized,
      step: serialized.step + 1,
      served: [...serialized.served, foreign],
    };
  }

  it('replaces it rather than resuming into a question with no way out', () => {
    const resumed = deserializeRound(parked(2), initSrs(), ownedSource('choice'));
    expect(resumed.served.map((q) => q.id)).not.toContain(foreign.id);
    // The learner lands on the step they left, holding a question this mode owns —
    // not back on the verdict of the one before it.
    expect(current(resumed).id.startsWith('choice:')).toBe(true);
    expect(resumed.step).toBe(3);
    // served and records stay aligned — finishRound pairs them by index.
    expect(resumed.served).toHaveLength(resumed.records.length + 1);
  });

  it('serves the next question straight away, and the summary stays honest', () => {
    const state0 = deserializeRound(parked(2), initSrs(), ownedSource('choice'));
    const served = current(state0);
    expect(served.id.startsWith('choice:')).toBe(true);
    const state = answerQuestion(state0, 'zzz').state;

    const summary = finishRound(state);
    expect(summary.total).toBe(3);
    expect(summary.missed.map((q) => q.id)).toEqual([served.id]);
  });

  it('keeps a pending question the mode does own', () => {
    let state = createRound(cfg({ seed: 11 }), initSrs(), ownedSource('choice'));
    state = nextQuestion(state);
    const pending = current(state);
    const resumed = deserializeRound(serializeRound(state), initSrs(), ownedSource('choice'));
    expect(resumed.current).toEqual(pending);
    expect(resumed.step).toBe(1);
  });
});

/**
 * The number range is a setting, not a property of the round: a learner who
 * narrows it while a round is parked expects the round they come back to to obey
 * it — the question already on stage included.
 */
describe('round — a range changed while the round was parked', () => {
  const WIDE = { rangeMin: 0, rangeMax: 999_999 };
  const NARROW = { rangeMin: 0, rangeMax: 100 };

  /** A source that draws strictly inside whatever range the round carries. */
  const rangedSource: QuestionSource = {
    eligibleBuckets: () => ['d0_15', 'teens_fused', 'twenties_fused', 'tens_y'],
    generate: (rng, ctx) => {
      const value = rng.int(ctx.config.rangeMin, ctx.config.rangeMax);
      return numberQuestion(`m:n${value}`, value);
    },
  };

  /** A round parked on `pending`, one answer in, started under the wide range. */
  function parkedOn(pending: Question): ReturnType<typeof serializeRound> {
    let state = createRound(cfg({ ...WIDE, size: 10, seed: 3 }), initSrs(), rangedSource);
    state = nextQuestion(state);
    state = answerQuestion(state, correctAnswerFor(current(state))).state;
    const serialized = serializeRound(state);
    return { ...serialized, step: serialized.step + 1, served: [...serialized.served, pending] };
  }

  it('replaces a pending question the new range no longer covers', () => {
    const tooBig = numberQuestion('m:n777777', 777_777);
    const resumed = deserializeRound(parkedOn(tooBig), initSrs(), rangedSource, NARROW);

    expect(resumed.served.map((q) => q.id)).not.toContain(tooBig.id);
    expect(numberValue(current(resumed))).toBeLessThanOrEqual(100);
    // The learner is still on the question they left, not one step back.
    expect(resumed.step).toBe(2);
  });

  it('keeps a pending question the new range still covers', () => {
    const small = numberQuestion('m:n42', 42);
    const resumed = deserializeRound(parkedOn(small), initSrs(), rangedSource, NARROW);
    expect(resumed.current).toEqual(small);
  });

  it('draws the rest of the round from the new range', () => {
    let state = deserializeRound(parkedOn(numberQuestion('m:n42', 42)), initSrs(), rangedSource, {
      ...NARROW,
      acceptNoAccents: true,
    });
    expect(state.config.rangeMax).toBe(100);

    for (let i = 0; i < 5; i += 1) {
      state = answerQuestion(state, correctAnswerFor(current(state))).state;
      state = nextQuestion(state);
      expect(numberValue(current(state))).toBeLessThanOrEqual(100);
    }
  });

  it('leaves the shape of the round alone — length, seed and mode are its own', () => {
    const parked = parkedOn(numberQuestion('m:n42', 42));
    const resumed = deserializeRound(parked, initSrs(), rangedSource, NARROW);
    expect(resumed.config.size).toBe(parked.config.size);
    expect(resumed.config.seed).toBe(parked.config.seed);
    expect(resumed.config.modeId).toBe(parked.config.modeId);
  });

  it('resumes unchanged when no live settings are handed in', () => {
    const tooBig = numberQuestion('m:n777777', 777_777);
    const resumed = deserializeRound(parkedOn(tooBig), initSrs(), rangedSource);
    expect(resumed.current).toEqual(tooBig);
    expect(resumed.config.rangeMax).toBe(WIDE.rangeMax);
  });

  it('stops re-serving a wrongQueue miss the range no longer covers', () => {
    const missed = numberQuestion('m:n777777', 777_777);
    const srs: SrsState = initSrs();
    srs.answeredCount = 100;
    srs.wrongQueue.push({ question: missed, reappearances: 0, consecutiveCorrect: 0, dueAt: 0 });

    // Due, and the only thing in the queue — a round under the wide range serves it…
    const wide = nextQuestion(createRound(cfg({ ...WIDE, seed: 7 }), srs, rangedSource));
    expect(current(wide).id).toBe(missed.id);

    // …but the same queue against a narrowed range is skipped, not clamped.
    const narrow = nextQuestion(createRound(cfg({ ...NARROW, seed: 7 }), srs, rangedSource));
    expect(current(narrow).id).not.toBe(missed.id);
    expect(numberValue(current(narrow))).toBeLessThanOrEqual(100);
  });

  it('leaves a price or a weight alone — the slider does not govern those', () => {
    const priced: Question = {
      id: 'grocery:p4.75',
      bucket: 'price_cents',
      prompt: { kind: 'price', euros: 4, cents: 75 },
      accepted: {
        canonical: 'cuatro con setenta y cinco',
        variants: [{ text: 'cuatro setenta y cinco' }],
      },
    };
    const resumed = deserializeRound(parkedOn(priced), initSrs(), rangedSource, NARROW);
    expect(resumed.current).toEqual(priced);
  });
});

/**
 * A retry round replays a fixed list instead of asking the source, so an item the
 * source refuses cannot be answered by generating something else: the list itself
 * has to give it up. The refused misses stay in the wrongQueue, which is where
 * they wait for a round that can grade them.
 */
describe('round — resuming a retry round whose items the mode cannot serve', () => {
  function ownedSource(prefix: string): QuestionSource {
    return {
      eligibleBuckets: () => ['d0_15'],
      generate: (rng) => numberQuestion(`${prefix}:n${rng.int(0, 99)}`, 5),
      canReplay: (question) => question.id.startsWith(`${prefix}:`),
    };
  }

  const first = numberQuestion('choice:n5', 5);
  const foreign = numberQuestion('grocery:q1500', 1500);
  const last = numberQuestion('choice:n7', 7);

  /** A retry round over `items`, exactly as the results screen would build one. */
  function retryRound(items: readonly Question[]): RoundState {
    const summary: RoundSummary = {
      modeId: 'choice',
      size: items.length,
      total: items.length,
      correctCount: 0,
      almostCount: 0,
      wrongCount: items.length,
      accuracy: 0,
      points: 0,
      bestCombo: 0,
      verdicts: [],
      missed: [...items],
    };
    return buildRetryRound(summary, cfg({ size: items.length }), initSrs());
  }

  /** Answer the first item, then serve the second and park the round there. */
  function parkedOnSecond(items: readonly Question[]): ReturnType<typeof serializeRound> {
    let retry = retryRound(items);
    retry = nextQuestion(retry);
    retry = answerQuestion(retry, correctAnswerFor(current(retry))).state;
    retry = nextQuestion(retry);
    return serializeRound(retry);
  }

  it('serves the next item instead of handing back the one it refused', () => {
    const parked = parkedOnSecond([first, foreign, last]);
    expect(parked.served.at(-1)?.id).toBe(foreign.id);

    const resumed = deserializeRound(parked, initSrs(), ownedSource('choice'));
    expect(resumed.retryItems.map((q) => q.id)).toEqual([first.id, last.id]);
    // A retry round is sized by its list, so the progress the drill shows follows it.
    expect(resumed.config.size).toBe(2);
    // The refused item is replaced in place by the next one still on the list.
    expect(current(resumed).id).toBe(last.id);

    const state = answerQuestion(resumed, correctAnswerFor(current(resumed))).state;
    expect(isRoundComplete(state)).toBe(true);
    expect(finishRound(state).total).toBe(2);
  });

  it('drops the items still to come, not only the one on stage', () => {
    let retry = retryRound([first, foreign, last]);
    retry = nextQuestion(retry);
    // Parked while the first item's verdict is on screen: nothing is pending, and
    // the next item up is one this mode cannot serve.
    retry = answerQuestion(retry, correctAnswerFor(current(retry))).state;

    const resumed = deserializeRound(serializeRound(retry), initSrs(), ownedSource('choice'));
    expect(resumed.retryItems.map((q) => q.id)).toEqual([first.id, last.id]);
    expect(current(nextQuestion(resumed)).id).toBe(last.id);
  });

  it('ends a retry round with nothing left it can serve', () => {
    const resumed = deserializeRound(
      parkedOnSecond([first, foreign]),
      initSrs(),
      ownedSource('choice'),
    );
    expect(resumed.retryItems.map((q) => q.id)).toEqual([first.id]);
    expect(isRoundComplete(resumed)).toBe(true);
    expect(nextQuestion(resumed).current).toBeNull();
    expect(finishRound(resumed).total).toBe(1);
  });

  it('keeps a retry round whose every item the mode still owns', () => {
    let retry = retryRound([first, last]);
    retry = nextQuestion(retry);
    const pending = current(retry);
    const resumed = deserializeRound(serializeRound(retry), initSrs(), ownedSource('choice'));
    expect(resumed.current).toEqual(pending);
    expect(resumed.retryItems.map((q) => q.id)).toEqual([first.id, last.id]);
    expect(resumed.config.size).toBe(2);
    expect(resumed.step).toBe(1);
  });

  it('keeps every item when resumed with no source to ask', () => {
    const resumed = deserializeRound(parkedOnSecond([first, foreign, last]), initSrs());
    expect(resumed.current?.id).toBe(foreign.id);
    expect(resumed.retryItems).toHaveLength(3);
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

  it('isRoundSerialized rejects a slot carrying a malformed question or record', () => {
    let state = createRound(cfg({ size: 3, seed: 4 }), initSrs(), makeStubSource());
    state = nextQuestion(state);
    state = answerQuestion(state, correctAnswerFor(current(state))).state;
    state = nextQuestion(state);
    const good = serializeRound(state);
    expect(isRoundSerialized(good)).toBe(true);

    expect(isRoundSerialized({ ...good, served: [...good.served, {}] })).toBe(false);
    expect(isRoundSerialized({ ...good, retryItems: [{ id: 'x' }] })).toBe(false);
    expect(isRoundSerialized({ ...good, records: [{ questionId: 'x' }] })).toBe(false);
    expect(isRoundSerialized({ ...good, config: { ...good.config, size: {} } })).toBe(false);
    expect(isRoundSerialized({ ...good, config: { ...good.config, seed: 'later' } })).toBe(false);
    expect(isRoundSerialized({ ...good, score: { points: 0 } })).toBe(false);
  });
});
