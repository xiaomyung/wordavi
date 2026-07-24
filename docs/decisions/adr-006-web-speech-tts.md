---
title: Browser speechSynthesis for listening mode
date: 2026-07-24
---

## Context
Listening mode needs spoken Spanish for numbers, prices, and quantities.

## Decision
Use the browser's `speechSynthesis` API with an es-ES voice, rather than server-rendered or bundled audio files.

## Why
It needs no storage, no backend, and no per-request cost, fitting the backend-free and offline-first constraints in [[adr-004-static-no-backend]] and [[adr-011-pwa-full-offline]]. Voice quality is good enough for the actual content in scope: numbers and prices.

## Consequences
Voice availability and quality vary by OS and browser and cannot be fully controlled. See [[adr-007-speech-recognition-optional]] for the matching decision on the input side.
