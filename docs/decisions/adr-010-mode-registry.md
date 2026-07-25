---
title: Plugin interface for practice modes
date: 2026-07-24
---

## Context
v1 ships six practice modes plus a mixed round, and more modes and subjects are expected later.

## Decision
Define a `LearningMode` plugin interface (`id`, `titleKey`, `requires`, a `QuestionSource` that generates and grades, `Prompt`, `AnswerZone`) and register modes rather than hardcoding mode-specific branches through the app. The shipped shape is documented in [[mode-registry]].

## Why
A registry keeps mode-specific logic isolated and lets capability requirements, such as speech recognition, and future subjects plug in without touching shared screens or engine code.

## Consequences
New modes must conform to the interface, and a contract suite runs every registered mode through the same assertions, so a mode that forgets a label key or claims a question it cannot render fails the build. The layering rules described in [[layers]] enforce that modes depend on the engine, never the reverse. See [[adr-007-speech-recognition-optional]] for a capability-gated mode built on this interface.
