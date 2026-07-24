---
title: Light SRS via skill buckets, not full SM-2
date: 2026-07-24
---

## Context
The app needs spaced repetition to steer practice toward weak spots, without the complexity of a full per-item scheduler.

## Decision
Use around 15 coarse skill buckets (units, teens-fused, twenties-fused, tens-y, hundreds regular/irregular, thousands, millions, decimals, price-cents, quantities, and similar) plus a capped wrong-answer queue (50 items, resurfaced after 3/8/20 questions), instead of full SM-2 or per-item statistics.

## Why
Bucket-level weighting is enough to steer practice toward weak number patterns without tracking hundreds of individual items, and the wrong-queue handles short-term reinforcement cheaply.

## Consequences
Bucket granularity is coarser than per-item SRS, an accepted tradeoff for v1 simplicity. See [[adr-005-localstorage-versioned-schema]] for how bucket state persists.
