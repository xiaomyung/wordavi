---
title: React, Vite, and strict TypeScript
date: 2026-07-24
---

## Context
wordavi needs a modern frontend stack that supports fast local iteration and a lean production build for a mobile-first PWA.

## Decision
Build the app with React, Vite, and TypeScript in strict mode.

## Why
Vite gives fast HMR and a small production bundle; React's component model fits a mode-based practice UI cleanly; strict TypeScript catches mismatches in the mode registry and SRS engine before runtime.

## Consequences
All new code must pass strict type checks. See [[adr-003-pnpm-biome-vitest-playwright]] for the surrounding toolchain and [[adr-010-mode-registry]] for how the type system enforces the mode interface.
