---
title: Speech recognition as an optional, capability-gated mode
date: 2026-07-24
---

## Context
A voice-input mode would let learners speak their answers, but browser SpeechRecognition support is inconsistent and most implementations require network access.

## Decision
Detect SpeechRecognition support at runtime, auto-hide the mode when it's unsupported, and show a toast (never a silent failure) when it needs network access that isn't available.

## Why
Treating SpeechRecognition as a strictly optional enhancement keeps the core app reliable regardless of browser or connectivity. A self-hosted recognition fallback was considered and deferred as unnecessary complexity for v1.

## Consequences
The mode registry, see [[adr-010-mode-registry]], must express capability requirements so unsupported modes are filtered before render. See [[adr-011-pwa-full-offline]] for the toast-not-fail rule applied here.
