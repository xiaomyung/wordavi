---
title: Decision records
---

This folder holds wordavi's **architecture decision records (ADRs)** — one note per significant choice. Each ADR follows the same short shape: the **context** that forced a decision, the **decision** itself, and the **consequences** we accepted. They are numbered in the order they were made and cross-linked to the decisions they depend on, so the graph reads as a chain of reasoning rather than a flat list.

Start from the [[overview|architecture overview]] for the system these decisions build, or browse by theme below.

## Product

Learner-facing behaviour and the Spanish-number domain the app teaches.

- [[adr-006-web-speech-tts|Browser speechSynthesis for listening]]
- [[adr-007-speech-recognition-optional|Optional speech recognition mode]]
- [[adr-008-es-es-eur|Peninsular Spanish and euro prices]]
- [[adr-009-light-srs-buckets|Light SRS via skill buckets]]
- [[adr-010-mode-registry|Mode registry plugin interface]]
- [[adr-013-forgiving-matching|Forgiving answer matching]]
- [[adr-019-es-ui-language|Spanish interface, chosen by the device]]
- [[adr-020-feedback-sounds|Synthesised feedback sounds, on by default]]
- [[adr-021-endless-rounds|An endless round alongside fixed ones]]
- [[adr-023-honest-microphone-copy|Honest copy about where speech happens]]
- [[adr-025-mixed-round|The start button always mixes]]

## Stack

The application's runtime technology and how state lives on the device.

- [[adr-001-react-vite-typescript|React, Vite, and TypeScript]]
- [[adr-002-tailwind-v4|Tailwind v4 CSS-first tokens]]
- [[adr-004-static-no-backend|Pure static app, no backend]]
- [[adr-005-localstorage-versioned-schema|Versioned localStorage schema]]
- [[adr-011-pwa-full-offline|Full offline precache PWA]]
- [[adr-012-react-i18next|react-i18next for the interface]]
- [[adr-022-install-affordances|Four install affordances]]
- [[adr-024-token-extension-policy|Design tokens land verbatim]]
- [[adr-026-overlay-scrollbar|A custom overlay scrollbar]]

## Infrastructure

How the app is built into an image, deployed, and served at the edge.

- [[adr-015-docker-nginx-unprivileged|Unprivileged nginx image]]
- [[adr-016-polling-deploy|Polling deploy]]
- [[adr-017-shared-edge-proxy|Shared edge proxy]]
- [[adr-018-quartz-docs|Obsidian vault via Quartz]]

## Process

Tooling and the workflow that keeps releases honest.

- [[adr-003-pnpm-biome-vitest-playwright|pnpm, Biome, Vitest, and Playwright]]
- [[adr-014-version-single-source|package.json single version source]]
