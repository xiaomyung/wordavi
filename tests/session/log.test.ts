import { afterEach, describe, expect, it } from 'vitest';
import {
  answerQuestion,
  buildRetryRound,
  closeRound,
  createRound,
  deserializeRound,
  evaluateStreak,
  finishRound,
  initSrs,
  nextQuestion,
  type Question,
  type RoundConfig,
  type RoundState,
  type SessionLogLevel,
  serializeRound,
  setSessionLogger,
  updateSrsOnAnswer,
} from '@/session';
import { correctAnswerFor, makeSequenceSource, numberQuestion } from './helpers';

/**
 * The session layer never imports the app logger (`@/services` is a banned
 * import) — it calls an injected sink. These tests pin the injection contract and
 * the transitions that must stay observable.
 */

type Entry = { level: SessionLogLevel; msg: string; data?: unknown };

function capture(): Entry[] {
  const entries: Entry[] = [];
  setSessionLogger((level, msg, data) => {
    entries.push(data === undefined ? { level, msg } : { level, msg, data });
  });
  return entries;
}

function current(state: RoundState): Question {
  const q = state.current;
  if (q === null) throw new Error('no current question');
  return q;
}

const config: RoundConfig = { modeId: 'drill', size: 2, rangeMin: 0, rangeMax: 99, seed: 3 };

afterEach(() => {
  setSessionLogger(null);
});

describe('session logger injection', () => {
  it('is silent until a logger is wired, and silent again after unwiring', () => {
    setSessionLogger(null);
    expect(() => createRound(config, initSrs(), makeSequenceSource([5]))).not.toThrow();

    const entries = capture();
    createRound(config, initSrs(), makeSequenceSource([5]));
    expect(entries).not.toHaveLength(0);

    setSessionLogger(null);
    const before = entries.length;
    createRound(config, initSrs(), makeSequenceSource([5]));
    expect(entries).toHaveLength(before);
  });

  it('reports every round transition: start, next, answer, finish, close', () => {
    const entries = capture();
    let state = createRound(config, initSrs(), makeSequenceSource([5, 6]));
    for (let i = 0; i < 2; i += 1) {
      state = nextQuestion(state);
      state = answerQuestion(state, correctAnswerFor(current(state))).state;
    }
    finishRound(state);
    closeRound(state);

    const messages = entries.map((entry) => entry.msg);
    for (const msg of [
      'round.start',
      'round.next',
      'round.answer',
      'round.finish',
      'round.close',
    ]) {
      expect(messages).toContain(msg);
    }

    const start = entries.find((entry) => entry.msg === 'round.start');
    expect(start?.level).toBe('info');
    expect(start?.data).toMatchObject({ modeId: 'drill', size: 2, seed: 3 });
    expect(entries.find((entry) => entry.msg === 'round.answer')?.data).toMatchObject({
      verdict: 'correct',
    });
  });

  it('reports SRS updates, wrongQueue churn and retry builds', () => {
    const entries = capture();
    let srs = updateSrsOnAnswer(initSrs(), numberQuestion('x', 5), 'wrong');
    srs = updateSrsOnAnswer(srs, numberQuestion('x', 5), 'correct');
    srs = updateSrsOnAnswer(srs, numberQuestion('x', 5), 'correct');

    const messages = entries.map((entry) => entry.msg);
    expect(messages).toContain('srs.update');
    expect(messages).toContain('srs.wrongQueue.push');
    expect(messages).toContain('srs.wrongQueue.exit');

    let state = createRound({ ...config, size: 1 }, srs, makeSequenceSource([5]));
    state = nextQuestion(state);
    state = answerQuestion(state, 'zzz').state;
    buildRetryRound(finishRound(state), config, state.srs);
    expect(entries.map((entry) => entry.msg)).toContain('round.retry.build');
  });

  it('reports a resumed round', () => {
    const state = createRound(config, initSrs(), makeSequenceSource([5]));
    const entries = capture();
    deserializeRound(serializeRound(state), state.srs, makeSequenceSource([5]));
    expect(entries.map((entry) => entry.msg)).toContain('round.resume');
  });

  it('reports streak changes only when a day is earned', () => {
    const entries = capture();
    evaluateStreak({ current: 0, best: 0, lastGoalDate: null }, '2026-07-24', false);
    expect(entries).toHaveLength(0);

    evaluateStreak({ current: 0, best: 0, lastGoalDate: null }, '2026-07-24', true);
    expect(entries.map((entry) => entry.msg)).toContain('goal.streak');
  });
});
