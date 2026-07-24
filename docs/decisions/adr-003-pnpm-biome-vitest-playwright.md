---
title: pnpm, Biome, Vitest, and Playwright
date: 2026-07-24
---

## Context
The project needs a fast, low-friction toolchain for package management, linting/formatting, and testing.

## Decision
Use pnpm for packages, Biome for lint and format (in place of ESLint plus Prettier), Vitest for unit tests, and Playwright restricted to chromium for end-to-end tests.

## Why
Biome replaces two tools with one fast binary and also enforces the project's layering rules through import bans; pnpm's strict `node_modules` catches phantom dependencies early; Vitest shares Vite's config and transform pipeline, avoiding a second build setup.

## Consequences
There is no separate ESLint or Prettier config to maintain. CI gates on Biome, Vitest, and Playwright, plus a lockfile check and the version-bump gate from [[adr-014-version-single-source]].
