---
title: Answers count as they are given, not when a round ends
date: 2026-07-25
---

## Context
The daily goal, the lifetime totals and the streak were all folded in by one transaction at the end of a round. A round the learner left part-played contributed nothing at all: six correct answers, then home, and the ring still read zero.

That is not an edge case. The mode rows are made to be dipped into — the home screen offers "continue · 6 of 20" on the row itself, which is the app inviting exactly the behaviour that counted for nothing. The mixed round from the big button tends to get played to its end; a single mode tends not to, so the goal looked like it ignored the modes.

## Decision
Fold each graded answer into today's row, the running totals and the streak as it is given. A finished round now only writes its final SRS state and clears the parked slot.

## Why
The alternative — keeping the round-end transaction and adding a second one for abandoned rounds — needs a definition of "abandoned" (a closed tab? a week-old parked round?) and has to avoid counting the same answers twice when the round is later resumed and finished. Counting once, at the moment the answer is graded, has neither problem: there is exactly one place an answer becomes a fact, and it is the same place whatever happens to the round around it.

It also makes [[adr-021-endless-rounds|the endless round's]] claim true, which said the goal and the SRS "count answers, not rounds". The SRS always did; the goal did not.

## Consequences
`commitAnswer` runs on every submit, so an answer costs four small `localStorage` writes rather than a share of one batch — imperceptible next to the render it accompanies, and the round slot was already being written on every answer anyway.

The streak can now be stamped mid-round. `evaluateStreak` was already idempotent for repeated same-day calls, so this needed nothing new, but it does mean the summary screen's "was the day already stamped?" question is answered by subtracting the round's own counted answers back out — which is what it did before, and still does.

A round played across midnight now counts each answer on the day it was actually given, rather than putting all of them on the day the round happened to end.
