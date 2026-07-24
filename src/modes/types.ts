import type { ComponentType } from 'react';
import type { Question, QuestionSource, Verdict } from '@/session';

/**
 * The `modes` layer contract.
 *
 * A mode owns two things and nothing else: how a question is *generated*
 * (its {@link QuestionSource}) and how it is *presented* (a Prompt zone and an
 * AnswerZone that drop into the one drill skeleton — design README: "One drill
 * skeleton serves all six modes; only the prompt zone and answer zone swap").
 *
 * Modes are service-free and translation-free:
 *   - speech/tts arrive as {@link DrillServices} props (structural interfaces
 *     declared here, never imported from `@/services`);
 *   - copy arrives pre-translated as {@link ModeLabels}, keyed by the i18n keys
 *     the mode declares in {@link LearningMode.labelKeys}. Modes never call `t()`.
 */

/** Registration + display order, matching the home-screen mode list. */
export const MODE_ORDER = ['words', 'digits', 'listen', 'choice', 'speak', 'grocery'] as const;

export type ModeId = (typeof MODE_ORDER)[number];

/** A browser capability a mode cannot work without. */
export type Capability = 'tts' | 'speech';

/** Why a recognition attempt ended without a usable result. */
export type RecognitionErrorKind = 'no-speech' | 'denied' | 'network' | 'aborted' | 'other';

export interface RecognitionHandlers {
  /** Partial hypothesis while the learner is still speaking. */
  interim?: (text: string) => void;
  /** Final n-best list, best first. */
  onFinal: (alternatives: string[]) => void;
  onError: (kind: RecognitionErrorKind) => void;
}

/** Handle returned by {@link DrillServices.startRecognition}. */
export interface RecognitionSession {
  stop: () => void;
}

/** Service handles injected by the drill screen (modes stay service-free). */
export interface DrillServices {
  speak: (text: string, opts?: { slower?: boolean }) => Promise<void>;
  isSpeaking: () => boolean;
  startRecognition: (h: RecognitionHandlers) => RecognitionSession;
}

/**
 * Translated copy for one mode: the i18n key itself is the lookup key, so the
 * drill prepares it with `Object.fromEntries(mode.labelKeys.map(k => [k, t(k)]))`
 * and no key-to-slot mapping table can drift.
 */
export type ModeLabels = Readonly<Record<string, string>>;

/** Read a label, falling back to the raw key so a missing string stays visible. */
export function labelOf(labels: ModeLabels, key: string): string {
  return labels[key] ?? key;
}

export interface PromptProps {
  question: Question;
  services: DrillServices;
  /** Sticky-per-round 0.75x speech rate (the drill owns the state). */
  slower: boolean;
  onToggleSlower: () => void;
  labels: ModeLabels;
}

export interface AnswerZoneProps {
  question: Question;
  services: DrillServices;
  /** null = unanswered. Set means the zone freezes and reveals. */
  verdict: Verdict | null;
  /** Canonical answer for reveal (numeral for digit-typed questions). */
  expectedDisplay: string;
  onSubmit: (given: string) => void;
  micDenied: boolean;
  onMicDenied: () => void;
  labels: ModeLabels;
  /** Optional "how do I enable the microphone?" escape hatch (drill-owned sheet). */
  onMicHelp?: () => void;
}

export interface LearningMode {
  id: ModeId;
  /** i18n keys under `modes.*` — never translated inside the mode. */
  titleKey: string;
  exampleKey: string;
  requires: readonly Capability[];
  /** Every i18n key this mode's Prompt/AnswerZone needs in {@link ModeLabels}. */
  labelKeys: readonly string[];
  /** SRS-aware generation via `ctx.suggestedBucket`. */
  source: QuestionSource;
  /**
   * Speak mode: choose which recognition alternative to submit (a dry-run
   * `matchText` over the n-best list). Absent = submit the first alternative.
   */
  pickGiven?: (alternatives: string[], question: Question) => string;
  Prompt: ComponentType<PromptProps>;
  AnswerZone: ComponentType<AnswerZoneProps>;
}
