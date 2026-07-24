---
title: Plugin interface for practice modes
date: 2026-07-24
---

## Context
v1 ships five practice modes, and more modes and subjects are expected later.

## Decision
Define a `LearningMode` plugin interface (`id`, `titleKey`, `requires`, `generate`, `check`, `Prompt`, `AnswerInput`) and register modes rather than hardcoding mode-specific branches through the app.

## Why
A registry keeps mode-specific logic isolated and lets capability requirements, such as speech recognition, and future subjects plug in without touching shared screens or engine code.

## Consequences
New modes must conform to the interface. The layering rules described in [[adr-001-react-vite-typescript]] and [[adr-003-pnpm-biome-vitest-playwright]] enforce that modes depend on the engine, never the reverse. See [[adr-007-speech-recognition-optional]] for a capability-gated mode built on this interface.
