import { describe, expect, it } from 'vitest';
import {
  allModes,
  findMode,
  getMode,
  type LearningMode,
  MODE_ORDER,
  modeRequires,
  registerMode,
} from '@/modes';

describe('mode registry', () => {
  it('registers all six modes in home-screen order', () => {
    expect(allModes().map((mode) => mode.id)).toEqual([
      'words',
      'digits',
      'listen',
      'choice',
      'speak',
      'grocery',
    ]);
  });

  it('MODE_ORDER is the registry order', () => {
    expect(allModes().map((mode) => mode.id)).toEqual([...MODE_ORDER]);
  });

  it('getMode returns the mode with the requested id', () => {
    for (const id of MODE_ORDER) {
      expect(getMode(id).id).toBe(id);
    }
  });

  it('getMode throws for an unregistered id', () => {
    expect(() => getMode('nope' as (typeof MODE_ORDER)[number])).toThrow(/not registered/);
  });

  it('findMode tolerates an untrusted string', () => {
    expect(findMode('grocery')?.id).toBe('grocery');
    expect(findMode('wordz')).toBeUndefined();
  });

  it('exposes capability metadata without filtering', () => {
    expect(modeRequires('words')).toEqual([]);
    expect(modeRequires('digits')).toEqual([]);
    expect(modeRequires('choice')).toEqual([]);
    expect(modeRequires('listen')).toEqual(['tts']);
    expect(modeRequires('grocery')).toEqual(['tts']);
    expect(modeRequires('speak')).toEqual(['speech']);
  });

  it('re-registering an id replaces it without changing the order', () => {
    const original = getMode('words');
    const replacement: LearningMode = { ...original, titleKey: 'modes.words.title.replaced' };
    registerMode(replacement);
    expect(getMode('words').titleKey).toBe('modes.words.title.replaced');
    expect(allModes()).toHaveLength(6);
    registerMode(original);
    expect(getMode('words').titleKey).toBe('modes.words.title');
  });
});
