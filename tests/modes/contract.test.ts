import { describe, expect, it } from 'vitest';
import { allModes } from '@/modes';
import { SKILL_BUCKETS } from '@/session';
import { roundConfig, ruString } from './helpers';

const modes = allModes();

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
