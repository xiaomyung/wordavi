---
title: Peninsular Spanish and euro prices
date: 2026-07-24
---

## Context
Numbers, prices, and quantities are spoken and written differently across Spanish-speaking regions and currencies.

## Decision
Fix the learning target to Peninsular Spanish (es-ES) with euro-denominated prices for v1.

## Why
The learner's real need, working at a grocery store, is grounded in Spain. Committing to one variant avoids ambiguous phrasing (for example "cuatro con setenta y cinco") and keeps matching and voice selection simple.

## Consequences
Other Spanish variants and currencies are out of scope until there's a concrete need. See [[adr-006-web-speech-tts]] for voice selection and [[adr-013-forgiving-matching]] for how phrasing variation within es-ES is still accepted.
