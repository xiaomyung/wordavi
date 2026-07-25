---
title: The start button always mixes; a mode row plays only its mode
date: 2026-07-25
---

## Context
Practising one mode repeatedly is comfortable and teaches less than switching. But a learner who deliberately picks a mode should get that mode, and a round left half-finished should be resumable. Those two wants collide over what the big start button on the home screen should do.

## Decision
The big button always starts a **mixed round**, drawn from every mode the device can currently run, and it only ever resumes a parked *mixed* round. A parked single-mode round is offered on its own mode row instead, with its progress on the chip. The mixed round is itself a registered mode that delegates: each question comes from another mode's source, and is rendered and graded by that mode.

## Why
The earlier behaviour — the button resuming whatever was last played — meant a learner who once tapped a single mode kept getting that mode forever without understanding why. Splitting the two affordances makes the rule statable in one sentence: the button mixes, a row is that row. Building mixing as a delegating mode rather than a special case in the drill keeps the screens free of composite logic.

## Consequences
Questions have to identify their origin mode, which is why every question id carries a mode prefix. Mixed rounds also avoid repetition deliberately, by considering the last few questions when drawing the next mode. And because a queued miss belongs to the mode that minted it, a mode declares which questions it can replay — see [[mode-registry]].
