---
title: Light SRS via skill buckets, not full SM-2
date: 2026-07-24
---

## Context
The app needs spaced repetition to steer practice toward weak spots, without the complexity of a full per-item scheduler.

## Decision
Use thirteen coarse skill buckets (0-15, fused teens, fused twenties, tens with y, round tens, regular hundreds, irregular hundreds, thousands, millions, decimals, price cents, fractional quantities, grams) plus a capped wrong-answer queue (50 items, resurfaced after 3/8/20 questions and retired after two consecutive non-wrong answers), instead of full SM-2 or per-item statistics.

## Why
Bucket-level weighting is enough to steer practice toward weak number patterns without tracking hundreds of individual items, and the wrong-queue handles short-term reinforcement cheaply.

## Consequences
Bucket granularity is coarser than per-item SRS, an accepted tradeoff for v1 simplicity. The queue turned out to need one extra rule: it is global, but a question's accepted answers belong to the mode that minted it, so a mode declares which questions it is able to replay - see [[mode-registry]]. See [[adr-005-localstorage-versioned-schema]] for how bucket state persists, and [[storage-schema]] for the stored shape.
