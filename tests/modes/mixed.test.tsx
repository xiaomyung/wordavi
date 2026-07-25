import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRng } from '@/engine';
import type { LearningMode, ModeId } from '@/modes';
import {
  allModes,
  findMode,
  getMode,
  MIXED_MODE_ID,
  MODE_ORDER,
  modeOfQuestion,
  setMixedAvailability,
} from '@/modes';
import type { Question, RoundConfig, SkillBucket } from '@/session';
import { generateFor, labelsFor, roundConfig, stubServices } from './helpers';

const mixed = getMode(MIXED_MODE_ID);

/** Mode id every question id is prefixed with (`words:n475` → `words`). */
function originOf(question: Question): string {
  return question.id.slice(0, question.id.indexOf(':'));
}

/**
 * Play `count` draws the way the round does: one rng for the whole run, and the
 * ids of the questions already served handed back as context.
 */
function playMixed(
  count: number,
  options: { seed?: number; bucket?: SkillBucket; config?: RoundConfig } = {},
): Question[] {
  const { seed = 7, bucket = 'd0_15', config = roundConfig({ modeId: MIXED_MODE_ID }) } = options;
  const rng = createRng(seed);
  const served: Question[] = [];
  for (let i = 0; i < count; i += 1) {
    served.push(
      mixed.source.generate(rng, {
        suggestedBucket: bucket,
        config,
        recentQuestionIds: served.slice(-5).map((q) => q.id),
      }),
    );
  }
  return served;
}

/** Longest run of consecutive questions from the same mode. */
function longestRun(questions: readonly Question[]): number {
  let best = 0;
  let run = 0;
  let previous = '';
  for (const question of questions) {
    const origin = originOf(question);
    run = origin === previous ? run + 1 : 1;
    previous = origin;
    best = Math.max(best, run);
  }
  return best;
}

beforeEach(() => {
  setMixedAvailability(null);
});

afterEach(() => {
  setMixedAvailability(null);
});

describe('mixed mode registration', () => {
  it('is registered but is not a home-screen row', () => {
    expect(mixed.id).toBe('mixed');
    expect(findMode('mixed')).toBe(mixed);
    expect(allModes()).toHaveLength(MODE_ORDER.length);
    expect(allModes().map((mode) => mode.id)).not.toContain('mixed');
  });

  it('needs no capability of its own and carries resolvable i18n keys', () => {
    expect(mixed.requires).toEqual([]);
    expect(mixed.titleKey).toBe('modes.mixed.title');
    expect(mixed.exampleKey.startsWith('modes.')).toBe(true);
  });

  it('declares every label key any mode may ask the drill for', () => {
    const keys = new Set(mixed.labelKeys);
    for (const mode of allModes()) {
      for (const key of mode.labelKeys) expect(keys, key).toContain(key);
    }
    // Union, not concatenation: shared keys appear once.
    expect(mixed.labelKeys).toHaveLength(keys.size);
  });
});

describe('mixed generation', () => {
  it('draws from every available mode over a round that visits every bucket', () => {
    const config = roundConfig({ modeId: MIXED_MODE_ID });
    const buckets = mixed.source.eligibleBuckets(config);
    const rng = createRng(7);
    const served: Question[] = [];
    for (let i = 0; i < 60; i += 1) {
      served.push(
        mixed.source.generate(rng, {
          // The round suggests an SRS-weighted bucket; cycling them is the
          // even-handed stand-in for that.
          suggestedBucket: buckets[i % buckets.length] as SkillBucket,
          config,
          recentQuestionIds: served.slice(-5).map((q) => q.id),
        }),
      );
    }
    expect([...new Set(served.map(originOf))].sort()).toEqual([...MODE_ORDER].sort());
  });

  it('draws only from the modes the screens declared available', () => {
    setMixedAvailability(['words', 'digits']);
    const origins = new Set(playMixed(40).map(originOf));
    expect([...origins].sort()).toEqual(['digits', 'words']);
  });

  it('falls back to every mode rather than leaving a round unanswerable', () => {
    setMixedAvailability([]);
    expect(new Set(playMixed(40).map(originOf)).size).toBeGreaterThan(1);

    setMixedAvailability(['nope' as ModeId]);
    expect(new Set(playMixed(40).map(originOf)).size).toBeGreaterThan(1);
  });

  it('never repeats a mode back to back while another one can serve the bucket', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const served = playMixed(30, { seed });
      expect(longestRun(served), `seed ${seed}`).toBe(1);
    }
  });

  it('keeps the mix shuffled for a bucket only some modes teach', () => {
    // price_cents is grocery's alone, so the fallback (all candidates) applies:
    // the streak rule must still not run away with the round.
    const served = playMixed(30, { bucket: 'price_cents' });
    expect(new Set(served.map(originOf))).toEqual(new Set(['grocery']));
    expect(served.every((q) => q.prompt.kind === 'price')).toBe(true);
  });

  it('repeats a mode only when it is the only one left', () => {
    setMixedAvailability(['words']);
    const served = playMixed(5);
    expect(served.map(originOf)).toEqual(['words', 'words', 'words', 'words', 'words']);
  });

  it('produces exactly the question its origin mode would have produced', () => {
    for (const mode of allModes()) {
      setMixedAvailability([mode.id]);
      const config = roundConfig({ modeId: MIXED_MODE_ID });
      const bucket = mode.source.eligibleBuckets(config)[0];
      if (bucket === undefined) throw new Error(`no eligible bucket for ${mode.id}`);
      // The composite spends one draw picking the mode, so the delegate sees
      // the same stream a solo round would after one call.
      const rng = createRng(99);
      rng.int(0, 1);
      const expected = mode.source.generate(rng, {
        suggestedBucket: bucket,
        config,
        recentQuestionIds: [],
      });
      const actual = mixed.source.generate(createRng(99), {
        suggestedBucket: bucket,
        config,
        recentQuestionIds: [],
      });
      expect(actual).toEqual(expected);
    }
  });

  it('offers the union of the available modes’ buckets', () => {
    const config = roundConfig({ modeId: MIXED_MODE_ID });
    setMixedAvailability(['words', 'grocery']);
    const union = new Set<SkillBucket>([
      ...getMode('words').source.eligibleBuckets(config),
      ...getMode('grocery').source.eligibleBuckets(config),
    ]);
    const eligible = mixed.source.eligibleBuckets(config);

    expect(new Set(eligible)).toEqual(union);
    expect(new Set(eligible).size).toBe(eligible.length);

    setMixedAvailability(['words']);
    expect(new Set(mixed.source.eligibleBuckets(config))).toEqual(
      new Set(getMode('words').source.eligibleBuckets(config)),
    );
  });

  it('honours the round range like the mode it delegates to', () => {
    const config = roundConfig({ modeId: MIXED_MODE_ID, rangeMin: 0, rangeMax: 20 });
    setMixedAvailability(['words', 'digits', 'choice']);
    for (const question of playMixed(20, { config })) {
      if (question.prompt.kind !== 'number') throw new Error('expected a number payload');
      expect(question.prompt.value).toBeLessThanOrEqual(20);
    }
  });
});

describe('modeOfQuestion', () => {
  it('round-trips every mode through its question ids', () => {
    for (const mode of allModes()) {
      const config = roundConfig({ modeId: mode.id });
      const bucket = mode.source.eligibleBuckets(config)[0];
      if (bucket === undefined) throw new Error(`no eligible bucket for ${mode.id}`);
      const question = generateFor(mode, bucket, 5, config);
      expect(modeOfQuestion(question).id).toBe(mode.id);
    }
  });

  it('falls back to a written mode for an id no mode claims', () => {
    const orphan: Question = {
      id: 'gone:n42',
      bucket: 'tens_y',
      prompt: { kind: 'number', value: 42 },
      accepted: { canonical: 'cuarenta y dos', variants: [{ text: 'cuarenta y dos' }] },
    };
    expect(modeOfQuestion(orphan).id).toBe('words');
    expect(modeOfQuestion({ ...orphan, id: 'no-prefix' }).id).toBe('words');
  });
});

describe('mixed wrongQueue replay', () => {
  function sampleOf(id: string): Question {
    const mode = getMode(id as ModeId);
    const config = roundConfig({ modeId: mode.id });
    const bucket = mode.source.eligibleBuckets(config)[0];
    if (bucket === undefined) throw new Error(`no eligible bucket for ${mode.id}`);
    return generateFor(mode, bucket, 4, config);
  }

  it('claims every mode’s question while the whole mix is available', () => {
    for (const mode of allModes()) {
      expect(mixed.source.canReplay?.(sampleOf(mode.id)), mode.id).toBe(true);
    }
  });

  it('claims only the available modes’ questions', () => {
    setMixedAvailability(['words', 'digits']);
    expect(mixed.source.canReplay?.(sampleOf('words'))).toBe(true);
    expect(mixed.source.canReplay?.(sampleOf('digits'))).toBe(true);
    expect(mixed.source.canReplay?.(sampleOf('grocery'))).toBe(false);
    expect(mixed.source.canReplay?.(sampleOf('speak'))).toBe(false);
  });

  it('claims an orphan id through the same fallback that renders it', () => {
    const orphan: Question = {
      id: 'gone:n42',
      bucket: 'tens_y',
      prompt: { kind: 'number', value: 42 },
      accepted: { canonical: 'cuarenta y dos', variants: [{ text: 'cuarenta y dos' }] },
    };
    expect(mixed.source.canReplay?.(orphan)).toBe(true);
    setMixedAvailability(['digits']);
    expect(mixed.source.canReplay?.(orphan)).toBe(false);
  });
});

describe('mixed zones', () => {
  const labels = labelsFor(mixed);

  function renderZones(mode: LearningMode, question: Question, onSubmit = vi.fn()) {
    render(
      <>
        <mixed.Prompt
          question={question}
          services={stubServices()}
          slower={false}
          onToggleSlower={vi.fn()}
          labels={labels}
        />
        <mixed.AnswerZone
          question={question}
          services={stubServices()}
          verdict={null}
          onSubmit={onSubmit}
          micDenied={false}
          onMicDenied={vi.fn()}
          labels={labels}
        />
      </>,
    );
    return { mode, onSubmit };
  }

  it('renders the numeral and the typed field for a words question', () => {
    const words = getMode('words');
    const question = generateFor(words, 'hundreds_reg', 3);
    const { onSubmit } = renderZones(words, question);

    expect(screen.getByTestId('numeral-prompt')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ciento uno' } });
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
    expect(onSubmit).toHaveBeenCalledWith('ciento uno');
  });

  it('renders the four tiles for a choice question', () => {
    const choice = getMode('choice');
    const question = generateFor(choice, 'd0_15', 3);
    renderZones(choice, question);

    expect(screen.getByTestId('spanish-phrase')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('renders the price tag for a grocery question', () => {
    const grocery = getMode('grocery');
    const question = generateFor(grocery, 'price_cents', 3);
    renderZones(grocery, question);

    expect(screen.getByPlaceholderText('например: dos con veinte')).toBeInTheDocument();
  });

  it('names the mode each question came from', () => {
    for (const mode of allModes()) {
      const config = roundConfig({ modeId: mode.id });
      const bucket = mode.source.eligibleBuckets(config)[0];
      if (bucket === undefined) throw new Error(`no eligible bucket for ${mode.id}`);
      const question = generateFor(mode, bucket, 8, config);
      expect(mixed.titleKeyFor?.(question)).toBe(mode.titleKey);
    }
  });

  it('picks a spoken alternative the way the speak mode would', () => {
    const speak = getMode('speak');
    const question = generateFor(speak, 'd0_15', 12);
    const canonical = 'canonical' in question.accepted ? question.accepted.canonical : '';
    const alternatives = ['no es un número', canonical];

    expect(mixed.pickGiven?.(alternatives, question)).toBe(
      speak.pickGiven?.(alternatives, question),
    );
    // A written question has no alternative picker: the first one stands.
    const words = generateFor(getMode('words'), 'd0_15', 12);
    expect(mixed.pickGiven?.(['uno', 'dos'], words)).toBe('uno');
  });
});
