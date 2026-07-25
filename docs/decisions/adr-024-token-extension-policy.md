---
title: Design tokens land verbatim, extensions stay marked
date: 2026-07-25
---

## Context
The visual design arrived as a handoff with its own token file. Implementation always needs more tokens than a design specifies — component sizes, animation timings, one-off surfaces — and the tempting shortcut is to edit the designed values while adding them.

## Decision
The handoff's tokens go in unchanged, and everything implementation adds goes in a clearly marked extensions section of the same file. No colour value may appear anywhere else in the codebase — not in a component, not in a stylesheet, not inline.

## Why
Keeping the designed values byte-identical makes a later handoff a diff instead of an archaeology exercise, and the marked section makes it obvious which values were decisions of the designer and which were consequences of building it. One file for every colour is what makes a re-skin a bounded change — see [[layers]].

## Consequences
A test fails if a hex value appears outside the token file, so the rule holds without anyone having to remember it. When a mockup and the token file disagreed, the token file won and the difference was recorded rather than silently reconciled.
