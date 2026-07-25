---
title: Synthesised feedback sounds, on by default
date: 2026-07-25
---

## Context
A drill is a fast loop of answer-and-verdict. Reading the verdict every time is slower than hearing it, and the target user practises in short bursts while doing something else.

## Decision
Play a short synthesised tone for each verdict — a gentle one for correct, a softer one for "almost", a low one for wrong — generated with the Web Audio API rather than shipped as audio files. On by default, with a settings toggle.

## Why
Synthesising costs no bytes and no extra requests, which matters for a fully precached app. On by default because the sound is quiet, informative and easy to turn off, and a learner who never opens Settings should still get the faster feedback loop.

## Consequences
The audio context must be created from a real user gesture or the first sound is dropped on iOS, so it is warmed up on the first interaction with the app. Sounds are never the only signal — every verdict is also visible — so muting loses nothing. See [[adr-011-pwa-full-offline]] for why nothing is fetched at runtime.
