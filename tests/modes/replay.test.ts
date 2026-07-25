import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  allModes,
  choiceOptions,
  findMode,
  getMode,
  MIXED_MODE_ID,
  modeIdOf,
  questionId,
  setMixedAvailability,
} from '@/modes';
import {
  answerQuestion,
  createRound,
  deserializeRound,
  initSrs,
  isQuestion,
  nextQuestion,
  type Question,
  type RoundConfig,
  type RoundState,
  type SrsState,
  serializeRound,
  updateSrsOnAnswer,
} from '@/session';
import { generateFor, roundConfig } from './helpers';

/**
 * The wrongQueue is global while a `Question.accepted` belongs to the mode that
 * minted it: `words:n475` grades Spanish spellings, `digits:n475` an integer.
 * These tests wire the real modes into a real round and follow one miss from the
 * queue it lands in to the rounds that may — and may not — replay it.
 */

const MISSED_ID = 'words:n475';

/** The words-mode question for 475, minted by the mode's own source. */
function wordsMiss(): Question {
  const pinned = roundConfig({ modeId: 'words', rangeMin: 475, rangeMax: 475 });
  const question = generateFor(getMode('words'), 'hundreds_reg', 1, pinned);
  expect(question.id).toBe(MISSED_ID);
  return question;
}

/** SRS holding one due miss of the words mode, nothing else. */
function srsAfterWordsMiss(): SrsState {
  const srs = updateSrsOnAnswer(initSrs(), wordsMiss(), 'wrong');
  // Past the +3 delay, so the item is due on the round's first question.
  srs.answeredCount = 100;
  return srs;
}

function roundFor(modeId: string, srs: SrsState, over: Partial<RoundConfig> = {}): RoundState {
  const mode = findMode(modeId);
  if (mode === undefined) throw new Error(`no mode ${modeId}`);
  return createRound(roundConfig({ modeId, size: 6, seed: 3, ...over }), srs, mode.source);
}

/** Serve `count` questions, missing every one so the round keeps its pace. */
function serve(state: RoundState, count: number): Question[] {
  const seen: Question[] = [];
  let live = state;
  for (let i = 0; i < count; i += 1) {
    live = nextQuestion(live);
    const question = live.current;
    if (question === null) throw new Error('no current question');
    seen.push(question);
    live = answerQuestion(live, 'zzz').state;
  }
  return seen;
}

beforeEach(() => {
  setMixedAvailability(null);
});

afterEach(() => {
  setMixedAvailability(null);
});

describe('cross-mode wrongQueue replay', () => {
  it('keeps a written miss out of every mode that grades it differently', () => {
    for (const modeId of ['digits', 'listen', 'choice', 'grocery']) {
      const seen = serve(roundFor(modeId, srsAfterWordsMiss()), 6);
      expect(
        seen.map((q) => q.id),
        modeId,
      ).not.toContain(MISSED_ID);
      expect(
        seen.every((q) => q.id.startsWith(`${modeId}:`)),
        modeId,
      ).toBe(true);
    }
  });

  it('grades the keypad answer to a digits question as correct, not as a written miss', () => {
    let state = roundFor('digits', srsAfterWordsMiss());
    state = nextQuestion(state);
    const question = state.current;
    if (question === null || question.prompt.kind !== 'number') {
      throw new Error('expected a digits number question');
    }
    expect(answerQuestion(state, String(question.prompt.value)).record.verdict).toBe('correct');
  });

  it('replays the miss into its own mode, where two correct answers retire it', () => {
    let state = roundFor('words', srsAfterWordsMiss(), { size: 20 });
    let replayed = 0;
    for (let i = 0; i < 20; i += 1) {
      state = nextQuestion(state);
      const question = state.current;
      if (question === null) throw new Error('no current question');
      if (question.id === MISSED_ID) replayed += 1;
      const { accepted } = question;
      const given = 'canonical' in accepted ? accepted.canonical : String(accepted.intVal);
      state = answerQuestion(state, given).state;
    }
    expect(replayed).toBeGreaterThan(0);
    expect(state.srs.wrongQueue).toHaveLength(0);
  });

  it('replays it into a mixed round, which hands it to the mode that minted it', () => {
    const mixed = getMode(MIXED_MODE_ID);
    expect(mixed.source.canReplay?.(wordsMiss())).toBe(true);
    expect(mixed.titleKeyFor?.(wordsMiss())).toBe(getMode('words').titleKey);

    const seen = serve(roundFor(MIXED_MODE_ID, srsAfterWordsMiss(), { size: 12 }), 12);
    expect(seen.map((q) => q.id)).toContain(MISSED_ID);
  });

  it('holds it back from a mixed round the browser cannot run its mode in', () => {
    const mixed = getMode(MIXED_MODE_ID);
    setMixedAvailability(['digits', 'choice']);
    expect(mixed.source.canReplay?.(wordsMiss())).toBe(false);

    const seen = serve(roundFor(MIXED_MODE_ID, srsAfterWordsMiss(), { size: 12 }), 12);
    expect(seen.map((q) => q.id)).not.toContain(MISSED_ID);
  });
});

/**
 * A question's id prefix and its payload kind belong together: the mode named by
 * the prefix is the one that has to draw the payload, and it draws exactly the
 * shape its own generator mints. Nothing can generate a pair that disagrees, but
 * questions are replayed from storage as data, and the shape guard on the way in
 * proves each field well-formed without pairing the two. The pair is therefore
 * checked by the only layer that knows which mode mints what: the source that
 * would have to serve it.
 */
describe('id prefix and payload kind must agree', () => {
  const WORDS_475 = 'cuatrocientos setenta y cinco';
  const PRICE_475 = 'cuatro con setenta y cinco';

  /** A price tag filed under `modeId`, which no generator of that mode can mint. */
  function pricedAs(modeId: string): Question {
    return {
      id: questionId(modeId, 'n475'),
      bucket: 'price_cents',
      prompt: { kind: 'price', euros: 4, cents: 75 },
      accepted: { canonical: PRICE_475, variants: [{ text: PRICE_475 }] },
    };
  }

  /** The mirror case: a bare number filed under the grocery mode. */
  const numberedAsGrocery: Question = {
    id: questionId('grocery', 'p4.75'),
    bucket: 'hundreds_reg',
    prompt: { kind: 'number', value: 475 },
    accepted: { canonical: WORDS_475, variants: [{ text: WORDS_475 }] },
  };

  it('is well-formed enough to reach a mode, prefix and all', () => {
    expect(isQuestion(pricedAs('choice'))).toBe(true);
    expect(isQuestion(numberedAsGrocery)).toBe(true);
    expect(modeIdOf(pricedAs('choice').id)).toBe('choice');
    expect(modeIdOf(numberedAsGrocery.id)).toBe('grocery');
  });

  it('is refused by every mode whose questions are plain numbers', () => {
    for (const modeId of ['words', 'digits', 'listen', 'choice', 'speak'] as const) {
      expect(getMode(modeId).source.canReplay?.(pricedAs(modeId)), modeId).toBe(false);
    }
  });

  it('is refused by the grocery mode, whose tag has no number to show', () => {
    expect(getMode('grocery').source.canReplay?.(numberedAsGrocery)).toBe(false);
  });

  it('is refused by a mixed round, which would hand it to that same mode', () => {
    const mixed = getMode(MIXED_MODE_ID);
    expect(mixed.source.canReplay?.(pricedAs('choice'))).toBe(false);
    expect(mixed.source.canReplay?.(numberedAsGrocery)).toBe(false);
  });

  it('claims every payload a mode really mints, in each of its buckets', () => {
    const mixed = getMode(MIXED_MODE_ID);
    const kinds = new Map<string, Set<string>>();
    for (const mode of allModes()) {
      const config = roundConfig({ modeId: mode.id });
      const seen = new Set<string>();
      for (const bucket of mode.source.eligibleBuckets(config)) {
        for (const seed of [1, 2, 3]) {
          const question = generateFor(mode, bucket, seed, config);
          seen.add(question.prompt.kind);
          expect(mode.source.canReplay?.(question) ?? true, `${mode.id}/${bucket}`).toBe(true);
          expect(mixed.source.canReplay?.(question) ?? true, `mixed/${question.id}`).toBe(true);
        }
      }
      kinds.set(mode.id, seen);
    }
    for (const modeId of ['words', 'digits', 'listen', 'choice', 'speak']) {
      expect([...(kinds.get(modeId) ?? [])].sort(), modeId).toEqual(['number']);
    }
    expect([...(kinds.get('grocery') ?? [])].sort()).toEqual(['price', 'quantity']);
  });

  it('never reaches the choice board through the wrongQueue', () => {
    const corrupt = pricedAs('choice');
    for (const modeId of ['choice', MIXED_MODE_ID]) {
      const srs = initSrs();
      srs.answeredCount = 100;
      srs.wrongQueue.push({
        question: corrupt,
        reappearances: 0,
        consecutiveCorrect: 0,
        dueAt: 0,
      });
      const seen = serve(roundFor(modeId, srs, { size: 6 }), 6);
      expect(
        seen.map((q) => q.id),
        modeId,
      ).not.toContain(corrupt.id);
    }
  });

  it('never reaches the choice board through a parked round either', () => {
    const choice = getMode('choice');
    const corrupt = pricedAs('choice');
    const parked = serializeRound(
      createRound(roundConfig({ modeId: 'choice', size: 5 }), initSrs(), choice.source),
    );

    const resumed = deserializeRound(
      { ...parked, step: 1, served: [corrupt] },
      initSrs(),
      choice.source,
    );
    expect(resumed.current).toBeNull();

    // …and the drill carries on with a question that does have four tiles.
    const next = nextQuestion(resumed).current;
    if (next === null) throw new Error('no question after the drop');
    expect(choiceOptions(next)).toHaveLength(4);
  });
});
