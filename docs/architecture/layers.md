---
title: Layers
---

## Why layers

wordavi is deliberately split into layers with a strict, one-directional
dependency rule: **each layer may only import from the layers below it, never
above or sideways across a boundary that is banned.** The goal is that a full
visual redesign touches only the top layer, and the number-grammar engine can
be tested in complete isolation with no framework in sight.

Every layer below exists as described, and the import bans are checked on each
run of the test suite. See [[overview]] for how the pieces fit together.

## The layers, bottom to top

```
engine      pure es-ES number grammar: generate, format, match/verdict
storage     localStorage read/write, shape guards, migrations
i18n        RU/EN/ES resources and the translator
   ↑ these three depend on nothing inside the app

session     rounds, light SRS, scoring, streaks        ← engine
services    speechSynthesis, recognition, share, PWA   ← storage, i18n
components  presentational only, tokens for styling    ← i18n
   ↑
modes       LearningMode registry, one module per mode  ← engine, session, components
   ↑
screens     full-page compositions                     ← everything except app
   ↑
app         shell, screen state, persistence, wiring
```

The three at the bottom are independent of each other, not a stack — `storage`
cannot import `engine`, and neither knows about the other. The arrows are what
the test enforces, and they are narrower than "may import anything below".

## What each layer is, and may import

### engine (pure, framework-free)

The heart of the app: turning numbers into Spanish text, formatting prices and
quantities, and — crucially — **matching a learner's answer and returning a
verdict** (`correct`, `almost`, `wrong`). It encodes all the grammar
in [[spanish-number-rules]].

- **May import:** nothing outside itself. No React, no DOM, no
  `localStorage`, no browser globals.
- **Why:** purity makes it exhaustively unit-testable and reusable. Given the
  same input it always returns the same output, so the grammar is pinned by
  Vitest tables rather than by clicking through the UI.

### storage

Typed read/write helpers over `localStorage`, with shape-guarded reads and
sequential schema migrations. Detailed in [[storage-schema]].

- **May import:** nothing inside the app — not even `engine`.
- **May not import:** everything else, React included.
- **Why:** the guards have to hold for data written by an older version of the
  app, so this layer describes the stored shapes independently and never borrows
  a type whose meaning might have changed since the data was written.

### services

Thin wrappers around browser capabilities that may be absent or online-only:
`speechSynthesis` (es-ES voices), `SpeechRecognition`, feedback sounds, haptics,
Web Share / mailto, install prompting, and service-worker registration. Each
wrapper reports a capability flag so callers can adapt.

- **May import:** `storage`, `i18n`.
- **May not import:** `engine`, `session`, `modes`, or UI. Services never render.
- **Why not `engine`:** a service that knew the grammar would be tempted to
  judge an answer. Judging belongs to the engine, and nothing else may do it.

### session

Orchestrates learning over time: fixed rounds and endless sessions, the light
SRS (thirteen skill buckets plus a capped `wrongQueue`), streaks, daily goal, and
score/combo.

- **May import:** `engine`.
- **May not import:** `storage`, `services`, `modes`, `i18n` or UI.
- **Why so strict:** session is a set of pure state transitions. It does not
  read or write `localStorage` — it returns the new state, and the app layer
  decides to persist it. That is what makes an entire round replayable in a test
  with no browser, and what keeps "when do we save?" answerable in one place.

### modes

The `LearningMode` registry. Each mode declares what it `requires` (a
capability, e.g. speech recognition), how it generates a question, how it checks
an answer, which questions it can replay, and which small `Prompt` / `AnswerZone`
components render it. Full contract in [[mode-registry]].

- **May import:** `engine`, `session`, `components`, `i18n` keys.
- **May not import:** `services`, `storage`, `screens`, `app`.
- **Why not `services`:** whether the device has a Spanish voice is not the
  mode's business. A mode states the capability it needs and the app layer
  decides whether that mode can run right now.

### components

Reusable presentational pieces — buttons, sliders, cards, the answer field, the
microphone — styled entirely from Tailwind v4 `@theme` tokens.

- **May import:** `i18n` (for its own labels) and nothing else in the app.
- **May not import:** `engine`, `session`, `services`, `storage`, `screens`, `app`.
- **Why:** this is the property the whole scheme exists for. A component cannot
  accidentally depend on the domain, so a redesign can rewrite this layer and the
  tokens without the grammar or the scheduler noticing.

### screens and app

Screens are full-page compositions; `app` is the shell that holds the screen
state machine, wires the services together, and performs persistence.

- **Screens may import:** everything except `app`.
- **Why:** the app composes screens, never the reverse. Everything a screen needs
  from the shell arrives as a prop, so a screen can be rendered on its own in a
  test with fabricated props.

## Enforcement: an architecture test

The arrows above are not a convention people are trusted to remember — they are
**enforced by a test**, `tests/architecture.test.ts`, so a violating import
fails `pnpm test` locally and blocks the PR in CI (see [[pipeline]]).

The test reads every import statement under `src/` and checks it against a table
of banned targets per layer. It also walks the resulting import graph and fails
on a cycle, which a per-file rule cannot see.

Each layer bans the layers it must not reach:

- `engine/**` bans `react`, `session`, `modes`, `services`, `storage`, and
  anything under `screens`/`components`.
- `session/**` bans `storage`, `services`, `modes`, `i18n` and all UI — it keeps
  only `engine`.
- `storage/**` and `i18n/**` ban every other layer, so both stand alone.
- `services/**` bans `engine`, `session`, `modes`, and UI.
- `components/**` bans `engine`, `session`, `services` and `storage` — this is
  what keeps a re-skin from having to understand the domain.
- `screens/**` bans `app`, so the shell composes the screens rather than the
  screens reaching back into it.

A lint rule would have been the more obvious home for this. It lives in a test
because the cycle check needs the whole graph at once, and because one table in
one file is easier to read than the same rules spread across lint overrides.

## Why a re-skin only touches the top

Because grammar lives in `engine`, timing and difficulty live in `session`, and
mode behaviour lives in `modes`, the screens and components hold **only layout
and style**. Every colour in the app resolves from one file, `src/styles/tokens.css`
— there is no hex value anywhere else, and a test fails if one appears. A visual
overhaul therefore edits the tokens and `components`, and the answer-matching and
the scheduler keep passing their tests untouched.

This was worth having twice over: the app was re-skinned from a design handoff
without a single change to the engine, and the scrollbar was replaced app-wide by
one new component plus four tokens.

See also [[mode-registry]] for how new question types slot into the `modes`
layer, and [[overview]] for the big picture.
