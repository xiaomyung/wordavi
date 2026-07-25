/**
 * Public API of the `modes` layer.
 *
 * Importing this barrel registers all seven modes (the side effect below), so
 * `allModes()` is populated for any consumer that reaches the registry through
 * it. Layer contract: modes may use react, `@/engine`, `@/session`,
 * `@/components` and i18n *keys* — never `@/services`, `@/storage` or screens.
 */

import { choiceMode } from './choice';
import { digitsMode } from './digits';
import { groceryMode } from './grocery';
import { listenMode } from './listen';
import { mixedMode } from './mixed';
import { registerMode } from './registry';
import { speakMode } from './speak';
import { wordsMode } from './words';

/* Explicit registration, in home-screen order (see MODE_ORDER). */
registerMode(wordsMode);
registerMode(digitsMode);
registerMode(listenMode);
registerMode(choiceMode);
registerMode(speakMode);
registerMode(groceryMode);
/* The composite mode is registered like the rest, but has no home-screen row:
   it is what the big start button plays (see mixed.tsx). */
registerMode(mixedMode);

export { drawForBucket, NUMBER_BUCKETS, type NumberBucket, planFor, roundRange } from './buckets';
export { answerValueOf, choiceMode, choiceOptions } from './choice';
export { digitsMode } from './digits';
export { groceryMode, grocerySource } from './grocery';
export { listenMode } from './listen';
export { mixedMode, modeOfQuestion, setMixedAvailability } from './mixed';
export { numeralFontSizePx, promptDisplay, promptSpanish } from './prompt';
export { modeIdOf, ownsQuestion, questionId } from './questionId';
export { allModes, findMode, getMode, modeRequires, registerMode } from './registry';
export { pickGiven, speakMode } from './speak';
export type {
  AnswerZoneProps,
  Capability,
  DrillServices,
  LearningMode,
  ModeId,
  ModeLabels,
  PromptProps,
  RecognitionErrorKind,
  RecognitionHandlers,
  RecognitionSession,
  SingleModeId,
} from './types';
export { labelOf, MIXED_MODE_ID, MODE_ORDER } from './types';
export { wordsMode } from './words';
