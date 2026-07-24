---
title: Mode registry
---

## The idea

Every way of practising in wordavi — type the Spanish, hear it and type the
number, pick from four choices, say it out loud — is a **`LearningMode`**: a
small object that knows how to make a question, check an answer, and render its
own prompt and input. The app keeps a flat **registry** of these objects.
Adding a practice style means adding one entry; the session engine and screens
never change.

Modes sit in the `modes` layer described in [[layers]]. They lean on the pure
`engine` for grammar (see [[spanish-number-rules]]) and on `session` for
scheduling.

> **Status.** v0.1.0 ships only the coming-soon page. The `LearningMode`
> interface and the six modes below are the **committed plan for v1**. This note
> is the spec they are built against, not a description of shipped code.

## The interface

```ts
/** A verdict from checking a learner's answer. */
export type Verdict =
  | { kind: 'correct' }
  | { kind: 'correctWithNote'; note: string } // accepted, but nudge the learner
  | { kind: 'wrong'; expected: string };

/** Capabilities a mode may require from the environment. */
export type Capability =
  | 'speechSynthesis' // hear the number spoken (es-ES)
  | 'speechRecognition'; // say the answer out loud

/** A single generated question, produced by a mode. */
export interface Question {
  /** The skill bucket this question exercises, for the SRS. */
  skill: SkillId;
  /** The canonical value under test, e.g. 475 or 4.75. */
  value: number;
  /** Everything the mode's Prompt/AnswerInput need to render, mode-specific. */
  payload: unknown;
}

/** The contract every practice style implements. */
export interface LearningMode {
  /** Stable id, used in the registry and in storage. */
  id: string;
  /** i18n key for the mode's display name (RU/EN). */
  titleKey: string;
  /** Capabilities that must be present, or the mode is hidden. */
  requires: readonly Capability[];
  /** Build a question for the given skill and difficulty. */
  generate(ctx: GenerateContext): Question;
  /** Judge a raw learner answer against the question. */
  check(question: Question, answer: string): Verdict;
  /** Renders the question (framework component). */
  Prompt: React.ComponentType<{ question: Question }>;
  /** Renders the answer control and reports the raw answer up. */
  AnswerInput: React.ComponentType<{
    question: Question;
    onAnswer: (raw: string) => void;
  }>;
}
```

`generate` and `check` are thin: they defer to the `engine` for all grammar and
matching, so two modes that both accept typed Spanish share the exact same
matcher and the same accepted-variant logic. `Prompt` and `AnswerInput` are the
only React the mode owns.

## The six v1 modes

| id | Title | Prompt shows | Answer input | `requires` |
| --- | --- | --- | --- | --- |
| `number-to-text` | Number → Spanish | a numeral, e.g. `475` | text field (Spanish words) | — |
| `text-to-number` | Spanish → number | Spanish words | numeric field | — |
| `listen-to-number` | Listening | speaker button (es-ES TTS) | numeric field | `speechSynthesis` |
| `multiple-choice` | Multiple choice | a numeral or phrase | four tappable options | — |
| `speak-it` | Say it | a numeral to pronounce | mic button (es-ES ASR) | `speechRecognition` |
| `prices-quantities` | Prices & quantities | a price or grocery quantity | text field | — |

How each implements the contract:

- **`number-to-text`** — `generate` picks a value in the configured range and
  formats the expected Spanish via the engine; `check` runs the engine matcher
  (NFD diacritic folding, accepted-variant sets) and returns the verdict,
  including `correctWithNote` for near-misses and hard `wrong` for rejected
  archaisms like `veinte y uno`. See [[spanish-number-rules]].
- **`text-to-number`** — the mirror: prompt is the engine-formatted words,
  `check` parses the typed digits and compares numerically (so `1000` and
  `1 000` both pass).
- **`listen-to-number`** — same `check` as `text-to-number`; the difference is
  `Prompt`, which speaks the value through the `speechSynthesis` service instead
  of printing it.
- **`multiple-choice`** — `generate` also builds plausible distractors (off-by-a-
  bucket errors: wrong tens-`y`, `cien`/`ciento` confusion); `check` is a simple
  option-equality test.
- **`speak-it`** — `Prompt` shows the numeral, `AnswerInput` streams from
  `SpeechRecognition`; `check` folds the transcript through the same engine
  matcher as `number-to-text`.
- **`prices-quantities`** — draws from the price and quantity skill buckets
  (`cuatro con setenta y cinco`, `dos kilos y medio`, `250 gramos`) and checks
  against the engine's accepted-set for money and grocery phrasings.

## Capability filtering

Each mode declares `requires`. At startup the `services` layer probes the
browser and produces a capability set; the registry is filtered to modes whose
requirements are all met.

- `speak-it` needs `speechRecognition` — **auto-hidden** where the browser lacks
  it (most desktop Firefox, many in-app browsers). It is never shown broken.
- `listen-to-number` needs `speechSynthesis` with an es-ES voice; without one it
  is hidden and the learner is nudged toward the reading modes.
- The four remaining modes have no requirements and are always available,
  including fully offline.

Filtering happens once, in one place, so no screen has to special-case a missing
API. This mirrors the PWA rule from [[overview]]: online-or-unsupported features
disappear cleanly rather than erroring.

## Adding a mode or a whole new subject

Because the registry is flat and typed, extension is additive:

- **A new practice style** (e.g. ordinal numbers, or a fill-the-blank drill):
  implement `LearningMode`, register it, add its `titleKey` to the RU/EN
  locale files, and — if it needs one — a new engine matcher. No change to
  `session` or the screens.
- **A whole new subject beyond numbers** (the long-term direction): the same
  interface generalises. `Question.skill` already keys into the SRS buckets in
  [[storage-schema]], so a new subject supplies its own engine functions and
  skill ids and reuses the identical session, scoring, and screen machinery.

The registry is the seam that keeps "what we teach" independent from "how the
app runs," which is the same separation the [[layers]] enforce.
