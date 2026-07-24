---
title: Forgiving answer matching over a full parser
date: 2026-07-24
---

## Context
Learners will type accented Spanish text with imperfect input methods and legitimate phrasing variation.

## Decision
Match typed answers with NFD diacritic folding and per-item accepted-variant sets, returning a verdict of correct, correctWithNote, or wrong, rather than building a full words-to-number parser.

## Why
A variant-set approach is simpler and safer than a general parser, and it lets specific archaic forms be deliberately hard-rejected, such as "veinte y uno" for 21, while still being forgiving about accents and minor spelling.

## Consequences
New accepted variants must be added by hand per item. See [[adr-008-es-es-eur]] for the language and locale this matching is scoped to.
