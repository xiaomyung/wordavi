---
title: Layers
---

## Why layers

wordavi is deliberately split into layers with a strict, one-directional
dependency rule: **each layer may only import from the layers below it, never
above or sideways across a boundary that is banned.** The goal is that a full
visual redesign touches only the top layer, and the number-grammar engine can
be tested in complete isolation with no framework in sight.

The layering is the committed plan for v1. Today (v0.1.0) only the coming-soon
screen exists; the import bans described below are being introduced as each
layer lands. See [[overview]] for the exists-vs-planned split.

## The layers, bottom to top

```
engine        pure es-ES number grammar: generate, format, match/verdict
  ↑
storage       localStorage read/write, shape guards, migrations
  ↑
services      browser APIs: speechSynthesis, SpeechRecognition, share, PWA
  ↑
session       rounds, endless sessions, light SRS, scoring, wrongQueue
  ↑
modes         LearningMode registry: generate/check/Prompt/AnswerInput per mode
  ↑
screens + components + tokens   the only layer a re-skin touches
```

## What each layer is, and may import

### engine (pure, framework-free)

The heart of the app: turning numbers into Spanish text, formatting prices and
quantities, and — crucially — **matching a learner's answer and returning a
verdict** (`correct`, `correctWithNote`, `wrong`). It encodes all the grammar
in [[spanish-number-rules]].

- **May import:** nothing outside itself. No React, no DOM, no
  `localStorage`, no browser globals.
- **Why:** purity makes it exhaustively unit-testable and reusable. Given the
  same input it always returns the same output, so the grammar is pinned by
  Vitest tables rather than by clicking through the UI.

### storage

Typed read/write helpers over `localStorage`, with shape-guarded reads and
sequential schema migrations. Detailed in [[storage-schema]].

- **May import:** `engine` (for types only).
- **May not import:** `session`, `modes`, `services`, or any UI.

### services

Thin wrappers around browser capabilities that may be absent or online-only:
`speechSynthesis` (es-ES voices), `SpeechRecognition`, Web Share / mailto, and
service-worker registration. Each wrapper reports a capability flag so callers
can adapt.

- **May import:** `engine`, `storage`.
- **May not import:** `session`, `modes`, or UI. Services never render.

### session

Orchestrates learning over time: fixed rounds and endless sessions, the light
SRS (~15 skill buckets plus a capped `wrongQueue`), streaks, daily goal, and
score/combo. It asks the engine to generate and check, and persists through
storage.

- **May import:** `engine`, `storage`, `services`.
- **May not import:** `modes` or UI. Session is headless — it could drive a
  test harness with no DOM.

### modes

The `LearningMode` registry. Each mode declares what it `requires` (a
capability, e.g. speech recognition), how it generates a question, how it
checks an answer, and which small `Prompt` / `AnswerInput` components render it.
Full contract in [[mode-registry]].

- **May import:** `engine`, `session`, `services`, and shared `components`.
- **May not import:** `screens`.

### screens + components + tokens

The presentation layer: full-page screens, reusable components, and the Tailwind
`@theme` design tokens (light/dark auto). **This is the only layer a redesign
touches.**

- **May import:** everything below.
- **May not:** contain grammar or SRS logic. If a screen needs to know whether
  an answer is right, it asks the engine or session; it never decides itself.

## Enforcement: Biome import bans

The arrows above are not a convention people are trusted to remember — they are
**enforced by Biome** (`noRestrictedImports`) in `biome.json`, so a violating
import fails `pnpm lint` locally and blocks the PR in CI (see [[pipeline]]).

Each layer bans the layers it must not reach. For example:

- `engine/**` bans imports of `react`, `session`, `modes`, `services`,
  `storage`, and anything under `screens`/`components`.
- `session/**` bans `modes` and all UI.
- `services/**` bans `session`, `modes`, and UI.

> Status: the ban rules are part of the v1 plan and land alongside the first
> real `engine` and `session` code. v0.1.0 has no cross-layer imports to guard
> yet.

## Why a re-skin only touches the top

Because grammar lives in `engine`, timing and difficulty live in `session`, and
mode behaviour lives in `modes`, the screens and components hold **only
layout and style**. Colours and spacing are Tailwind v4 `@theme` tokens with a
`class`-based dark mode. A visual overhaul therefore edits `tokens` and
`components` and nothing else — the engine's answer-matching and the SRS
scheduler are untouched and their tests keep passing. That property is the whole
reason the boundaries are enforced rather than merely suggested.

See also [[mode-registry]] for how new question types slot into the `modes`
layer, and [[overview]] for the big picture.
