---
title: What a parked round re-reads from settings
date: 2026-07-25
---

## Context
A round carries a `RoundConfig` — its mode, its length, its seed, the number range and the accent tolerance — captured when it started. A parked round is stored with that config and resumed from it, which meant a learner could narrow the number range in Settings, return to the round waiting for them, and be looking at the same six-digit number they left. Every question after it came from the old range too.

The range is a setting, not a property of the round. The app offers a slider and then a round that ignored it is simply wrong.

## Decision
Split the config in two. On resume, the **range and the accent tolerance** are re-read from settings and replace what the round stored; the **mode, the length and the seed** are not. If the question already on stage falls outside the new range it is replaced in place — same step number, a question that fits — rather than the round rewinding a step.

The same rule governs the wrongQueue: a miss parked from a wider range is skipped while the narrower one is set, instead of being re-served or clamped.

## Why
The dividing line is whether re-reading the setting would rewrite the round or steer the rest of it. Length and seed decide what "question 7 of 20" already means: changing the length mid-round would make a round the learner is 15 answers into either finish instantly or grow, and changing the seed would break the deterministic resume the round slot depends on. The range and the accent tolerance decide only what comes next, so they can follow the learner's latest word without contradicting anything already on screen.

Replacing the stale question rather than dropping it keeps the progress honest. Dropping it alone would leave the drill showing the verdict of the question *before* it, which reads as the round having gone backwards — the same reason applies to a question a mode can no longer present, so both now take this path.

A retry round is exempt: it replays a named list of misses the learner explicitly asked for, and filtering that by a slider would quietly shorten what they requested.

## Consequences
The number range is enforced in one place in the session layer rather than by each mode, because only a plain numeral is governed by it — a shelf price or a scale weight has its own scale and is left alone, which is what [[adr-008-es-es-eur|the grocery mode]] needs.

`deserializeRound` takes an optional fourth argument, and omitting it rehydrates exactly as before — the drill is the only caller that has settings to hand. See [[storage-schema]] for what a resume reads.
