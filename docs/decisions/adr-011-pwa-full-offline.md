---
title: Full offline precache as a PWA
date: 2026-07-24
---

## Context
The learner needs the app to work reliably without a stable connection, for example while at work.

## Decision
Precache the full app for offline use as a PWA. Features that inherently need the network, namely voice recognition, stay online-only and show a toast rather than failing silently.

## Why
Full precache means the core learning loop never depends on connectivity. Explicit toasts on the few online-only features keep failures legible instead of confusing.

## Consequences
Every release must keep the offline precache list current with the build. A new version never installs itself silently: the learner is offered a reload, and the offer waits if a drill is in progress, so an update can never discard a round mid-question. See [[adr-007-speech-recognition-optional]] for the one deliberately online-only feature and [[adr-015-docker-nginx-unprivileged]] for the cache headers that support this.
