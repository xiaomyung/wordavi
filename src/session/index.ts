/* Goal & streak */
export { applyAnswersToDay, dayDiff, evaluateStreak, isGoalMet, toGoalVerdicts } from './goal';
/* Logging injection */
export type { SessionLogger, SessionLogLevel } from './log';
export { setSessionLogger, slog } from './log';
/* Deterministic rng (engine-seeded, draw-counting) */
export { makeCountingRng } from './rng';
/* Rounds */
export type { AnswerOutcome } from './round';
export {
  answerQuestion,
  buildRetryRound,
  closeRound,
  createRound,
  deserializeRound,
  finishRound,
  isRoundComplete,
  isRoundSerialized,
  nextQuestion,
  serializeRound,
} from './round';
/* Scoring */
export { applyVerdict, initScore, POINTS } from './score';
/* SRS */
export {
  accuracyOf,
  bucketWeight,
  classifyBucket,
  classifyNumber,
  deserializeSrs,
  dueDelay,
  errorRateOf,
  initSrs,
  masteryFloorOf,
  pickBucket,
  pickDueWrongItem,
  serializeSrs,
  updateSrsOnAnswer,
  WRONG_QUEUE_CAP,
  weightOf,
} from './srs';

/* Stats */
export type { GroupStat, MonthStat, SessionStats } from './stats';
export { computeStats } from './stats';
export type {
  Accepted,
  AcceptedDigits,
  AnswerRecord,
  BucketStat,
  CountingRng,
  DayRowLike,
  DisplayGroup,
  GoalVerdict,
  PromptPayload,
  Question,
  QuestionContext,
  QuestionSource,
  RoundConfig,
  RoundSerialized,
  RoundSize,
  RoundState,
  RoundSummary,
  Score,
  SkillBucket,
  SrsState,
  StreakState,
  Verdict,
  WrongQueueItem,
} from './types';
/* Shared types & constants */
export {
  BUCKET_TO_GROUP,
  DISPLAY_GROUP_ORDER,
  DISPLAY_GROUPS,
  SKILL_BUCKETS,
} from './types';
