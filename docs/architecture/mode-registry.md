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


## The interface

```ts
/** A browser capability a mode cannot work without. */
export type Capability = 'tts' | 'speech';

export interface LearningMode {
  id: ModeId;
  /** i18n keys under `modes.*` — a mode never calls the translator itself. */
  titleKey: string;
  exampleKey: string;
  requires: readonly Capability[];
  /** Every key this mode's Prompt and AnswerZone need, resolved for them. */
  labelKeys: readonly string[];
  /** Where questions come from, and which ones this mode can grade. */
  source: QuestionSource;
  /** Speak mode only: choose which recognition alternative to submit. */
  pickGiven?: (alternatives: string[], question: Question) => string;
  /** Composite modes only: per-question title, since questions come from elsewhere. */
  titleKeyFor?: (question: Question) => string;
  Prompt: ComponentType<PromptProps>;
  AnswerZone: ComponentType<AnswerZoneProps>;
}

/** Generation and grading, in the session layer so a round never imports a mode. */
export interface QuestionSource {
  eligibleBuckets(config: RoundConfig): readonly SkillBucket[];
  generate(rng: Rng, ctx: QuestionContext): Question;
  /** Whether this source can present and grade a question it did not just generate. */
  canReplay?(question: Question): boolean;
  check(question: Question, given: string): AnswerVerdict;
}
```

Three things about this shape are worth explaining, because none of them is
obvious from the types.

**A mode emits i18n keys, never translated text.** `titleKey`, `exampleKey` and
`labelKeys` are keys; the drill resolves them and hands the strings down as
`labels`. That is what lets the interface language change under a running app,
and it is why a mode cannot accidentally hard-code Russian.

**Grading lives in a `QuestionSource`, not in the mode.** The source belongs to
the `session` layer's vocabulary, so a round can generate and judge without ever
importing a mode — which is what the layer bans in [[layers]] require.

**`canReplay` is what keeps the wrongQueue honest.** The queue of recent misses
is global, but a question's accepted answers belong to whichever mode minted it:
a missed numeral is graded against Spanish spellings, the same numeral in the
digits mode against an integer. Replaying one into the other would mark a correct
answer wrong — and since an item only leaves the queue after two non-wrong
answers, it would be stuck punishing the learner indefinitely. So each source
claims only what it can actually serve, and the mixed round claims everything it
can resolve back to an available mode.

## The six modes, plus the mixed round

| id | Prompt shows | Answer | `requires` |
| --- | --- | --- | --- |
| `words` | a numeral, e.g. `475` | text field, Spanish words | — |
| `digits` | Spanish words | numeric keypad | — |
| `listen` | a speaker button (es-ES) | numeric keypad | `tts` |
| `choice` | a numeral | four tappable options | — |
| `speak` | a numeral to pronounce | microphone | `speech` |
| `grocery` | a price tag or a weight | text field | — |
| `mixed` | whatever the drawn mode shows | that mode's own | — |

- **`words`** grades through the engine matcher: diacritic folding, accepted
  variants, hard rejection of archaisms like `veinte y uno`. See
  [[spanish-number-rules]].
- **`digits`** is the mirror, comparing numerically, so `1000` and `1 000` both
  pass.
- **`listen`** shares `digits`' grading; only the prompt differs — it speaks the
  value instead of printing it.
- **`choice`** builds confusable distractors rather than random ones: a wrong
  tens-`y`, `cien` against `ciento`, `quinientos` against `setecientos`.
- **`speak`** folds the recognition transcript through the same matcher as
  `words`, choosing from the n-best list the alternative that grades best.
- **`grocery`** draws prices and weights (`cuatro con setenta y cinco`,
  `dos kilos y medio`, `250 gramos`) and accepts every phrasing a cashier might
  use, including cross-unit equivalents like `medio kilo` for `500 gramos`.

## Capability filtering

Each mode declares `requires`. At startup the `services` layer probes the
browser and produces a capability set; the registry is filtered to modes whose
requirements are all met.

- `speak` needs `speech` (recognition) — **paused with an explanation** where the
  browser lacks it, or where the browser has the API but no working recogniser
  behind it. It is never shown as if it worked.
- `listen` needs `tts` with an es-ES voice; without one the row is paused and
  offers instructions for adding a Spanish voice.
- The other five — `words`, `digits`, `choice`, `grocery` and `mixed` — require
  nothing and stay available fully offline. `grocery` speaks the price when it
  can, but that is an optional replay, not a requirement: at a till the answer is
  typed.

Filtering happens once, in one place, so no screen has to special-case a missing
API. This mirrors the PWA rule from [[overview]]: online-or-unsupported features
disappear cleanly rather than erroring.

## The mixed round

The big start button on home is not a mode row: it plays a **mixed round**, in
which every question comes from another of the modes the browser can currently
serve. It is built as one more `LearningMode` (`id: 'mixed'`) that delegates —
generation asks an available mode's own generator, and the prompt and answer
controls are that mode's own, resolved from the question id (every question id
carries the mode that made it). It is registered like the rest but deliberately
left out of the mode-list order, so home still shows exactly the mode rows
above, and the round, scoring, parked-round and retry machinery needs no special
case.

Two rules keep the mix honest:

- **Availability.** The screens hand the mixed mode the list of modes that pass
  the capability filtering described above, so a listening mode never turns up
  inside a mixed round on a device with no Spanish voice.
- **Anti-streak.** A mode used by either of the last two questions is skipped
  while another candidate exists, so a uniform draw cannot clump into "three by
  ear in a row". A question the SRS brings back for another try still replays
  its own mode: revision outranks shuffling.

Tapping a mode row is unchanged — that plays only that mode, start to finish.

The big button stays the mixed round even when something is left unfinished. A
parked round takes it over only when the parked round *is* the mixed one; a
parked single-mode round waits on its own mode row, which shows how far it got
("continue · 3 of 10") and picks it up when tapped. Starting a new round from the
big button while a single-mode round is parked replaces that parked round on the
first answer — there is one parked slot, and no dialog stands between the learner
and practising.

## Adding a mode or a whole new subject

Because the registry is flat and typed, extension is additive:

- **A new practice style** (e.g. ordinal numbers, or a fill-the-blank drill):
  implement `LearningMode`, register it, add its `titleKey` to the three
  locale files, and — if it needs one — a new engine matcher. No change to
  `session` or the screens.
- **A whole new subject beyond numbers** (the long-term direction): the same
  interface generalises. `Question.skill` already keys into the SRS buckets in
  [[storage-schema]], so a new subject supplies its own engine functions and
  skill ids and reuses the identical session, scoring, and screen machinery.

The registry is the seam that keeps "what we teach" independent from "how the
app runs," which is the same separation the [[layers]] enforce.
