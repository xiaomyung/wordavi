import { vi } from 'vitest';
import { createRng } from '@/engine';
import ru from '@/i18n/resources/ru.json';
import type { DrillServices, LearningMode, ModeLabels } from '@/modes';
import type { Question, RoundConfig, SkillBucket } from '@/session';

/** Stub {@link DrillServices}: modes must never reach past this seam. */
export function stubServices(over: Partial<DrillServices> = {}): DrillServices {
  return {
    speak: vi.fn(() => Promise.resolve()),
    isSpeaking: vi.fn(() => false),
    startRecognition: vi.fn(() => ({ stop: vi.fn() })),
    ...over,
  };
}

type Tree = { [key: string]: string | Tree };

/** Resolve a dotted i18n key against a resource tree. */
export function ruString(key: string): string | undefined {
  let node: string | Tree | undefined = ru as Tree;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** What the drill prepares: every declared label key, translated. */
export function labelsFor(mode: LearningMode): ModeLabels {
  return Object.fromEntries(mode.labelKeys.map((key) => [key, ruString(key) ?? key]));
}

export function roundConfig(over: Partial<RoundConfig> = {}): RoundConfig {
  return {
    modeId: 'words',
    size: 10,
    rangeMin: 0,
    rangeMax: 1_000_000,
    seed: 1,
    ...over,
  };
}

/** Generate one question for a specific bucket, the way the round would. */
export function generateFor(
  mode: LearningMode,
  bucket: SkillBucket,
  seed: number,
  config: RoundConfig = roundConfig(),
): Question {
  return mode.source.generate(createRng(seed), { suggestedBucket: bucket, config });
}
