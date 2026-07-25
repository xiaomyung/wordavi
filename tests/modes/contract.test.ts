import { describe, expect, it } from 'vitest';
import { allModes, choiceOptions, getMode, MIXED_MODE_ID } from '@/modes';
import { SKILL_BUCKETS } from '@/session';
import { generateFor, roundConfig, ruString } from './helpers';

const modes = allModes();

/** One question per mode, generated the way a round of that mode would. */
function sampleQuestions(seed = 6): ReturnType<typeof generateFor>[] {
  return modes.map((mode) => {
    const config = roundConfig({ modeId: mode.id });
    const bucket = mode.source.eligibleBuckets(config)[0];
    if (bucket === undefined) throw new Error(`no eligible bucket for ${mode.id}`);
    return generateFor(mode, bucket, seed, config);
  });
}

describe('LearningMode contract', () => {
  it.each(modes.map((mode) => [mode.id, mode] as const))('%s is fully specified', (_id, mode) => {
    expect(typeof mode.source.generate).toBe('function');
    expect(typeof mode.source.eligibleBuckets).toBe('function');
    expect(typeof mode.Prompt).toBe('function');
    expect(typeof mode.AnswerZone).toBe('function');
    expect(mode.titleKey.startsWith('modes.')).toBe(true);
    expect(mode.exampleKey.startsWith('modes.')).toBe(true);
    expect(Array.isArray(mode.requires)).toBe(true);
    expect(mode.labelKeys.length).toBeGreaterThan(0);
  });

  it.each(modes.map((mode) => [mode.id, mode] as const))(
    '%s carries i18n keys that resolve',
    (_id, mode) => {
      for (const key of [mode.titleKey, mode.exampleKey, ...mode.labelKeys]) {
        expect(ruString(key), key).toBeTypeOf('string');
      }
    },
  );

  it.each(modes.map((mode) => [mode.id, mode] as const))(
    '%s declares only real skill buckets and at least one',
    (_id, mode) => {
      const eligible = mode.source.eligibleBuckets(roundConfig());
      expect(eligible.length).toBeGreaterThan(0);
      for (const bucket of eligible) {
        expect(SKILL_BUCKETS).toContain(bucket);
      }
      expect(new Set(eligible).size).toBe(eligible.length);
    },
  );

  it('only speak overrides pickGiven', () => {
    for (const mode of modes) {
      expect(typeof mode.pickGiven === 'function').toBe(mode.id === 'speak');
    }
  });

  it('capability requirements are limited to the declared set', () => {
    for (const mode of modes) {
      for (const capability of mode.requires) {
        expect(['tts', 'speech']).toContain(capability);
      }
    }
  });
});

/**
 * The wrongQueue is global, so a round is offered items from every mode. Each
 * source has to claim exactly what its own zones can present and grade — the
 * question's `accepted` belongs to the mode that minted it.
 */
describe('wrongQueue replay claims', () => {
  const samples = sampleQuestions();

  it('every single mode claims its own question and refuses the others', () => {
    modes.forEach((mode, i) => {
      const own = samples[i];
      if (own === undefined) throw new Error(`no sample for ${mode.id}`);
      expect(mode.source.canReplay?.(own), mode.id).toBe(true);
      samples.forEach((foreign, j) => {
        if (i === j || foreign === undefined) return;
        expect(mode.source.canReplay?.(foreign), `${mode.id} vs ${foreign.id}`).toBe(false);
      });
    });
  });

  it('the mixed mode claims every question, because it grades through the origin', () => {
    const mixed = getMode(MIXED_MODE_ID);
    for (const question of samples) {
      expect(mixed.source.canReplay?.(question), question.id).toBe(true);
    }
  });

  it('choice always has four tiles for a question it claims', () => {
    const choice = getMode('choice');
    const config = roundConfig({ modeId: 'choice' });
    for (const bucket of choice.source.eligibleBuckets(config)) {
      for (const seed of [1, 2, 3]) {
        const question = generateFor(choice, bucket, seed, config);
        expect(choice.source.canReplay?.(question)).toBe(true);
        expect(choiceOptions(question), `${bucket}/${seed}`).toHaveLength(4);
      }
    }
    // The payloads that would leave it with no tiles are exactly the ones it
    // refuses, so the drill can never show an unanswerable board.
    for (const question of samples) {
      if (choiceOptions(question).length === 0) {
        expect(choice.source.canReplay?.(question), question.id).toBe(false);
      }
    }
  });
});
