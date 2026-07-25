---
title: Honest copy about where speech recognition happens
date: 2026-07-25
---

## Context
The spoken-answer mode uses the browser's speech recognition. It is easy to describe that as private — the microphone is on the learner's own phone, and the app keeps nothing. That description would be wrong: browser implementations stream the audio to the vendor's servers to transcribe it.

## Decision
Never claim on-device or unrecorded speech. The microphone copy says what is true — that we keep nothing — and the mode requires a network connection openly. When the browser has the recognition API but no working recogniser behind it (a network error while demonstrably online), say so plainly and fall back to typing for the rest of the round.

## Why
A privacy claim that is not literally true is not worth the reassurance it buys, particularly for a user who cannot read the source. The vaguer failure — "something went wrong" while the phone is clearly online — is the one that makes people distrust an app; naming the cause and offering the keyboard keeps the round going.

## Consequences
The mode is online-only by nature, which is why it pauses with an explanation offline rather than pretending. See [[adr-007-speech-recognition-optional]] for the capability gating this sits on, and the privacy section of [[user-guide]], which states the same thing in the learner's own words.
