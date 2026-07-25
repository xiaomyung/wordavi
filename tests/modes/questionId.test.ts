import { describe, expect, it } from 'vitest';
import {
  allModes,
  findMode,
  getMode,
  MIXED_MODE_ID,
  modeIdOf,
  modeOfQuestion,
  questionId,
} from '@/modes';
import { generateFor } from './helpers';

/** Every registered mode, the composite one included. */
const modes = [...allModes(), getMode(MIXED_MODE_ID)];

describe('question ids', () => {
  it.each(modes.map((mode) => mode.id))('%s round-trips through modeIdOf', (id) => {
    expect(modeIdOf(questionId(id, 'n475'))).toBe(id);
  });

  it.each(modes.map((mode) => [mode.id, mode] as const))(
    '%s stamps every generated question with a resolvable mode id',
    (id, mode) => {
      for (const bucket of mode.source.eligibleBuckets({
        modeId: id,
        size: 10,
        rangeMin: 0,
        rangeMax: 1_000_000,
        seed: 1,
      })) {
        const question = generateFor(mode, bucket, 7);
        const origin = modeIdOf(question.id);
        expect(findMode(origin), `${id} → ${question.id}`).toBeDefined();
        // A mixed round hands the question to whichever mode minted it; every
        // other mode only ever mints its own.
        expect(origin).toBe(id === MIXED_MODE_ID ? modeOfQuestion(question).id : id);
      }
    },
  );

  it('reads no mode out of an id that carries no prefix', () => {
    expect(modeIdOf('')).toBe('');
    expect(modeIdOf('n475')).toBe('');
  });

  it('keeps the suffix intact, separator and all', () => {
    // grocery prices carry a dot; nothing may re-split on it.
    expect(questionId('grocery', 'p2.35')).toBe('grocery:p2.35');
    expect(modeIdOf('grocery:p2.35')).toBe('grocery');
  });
});
