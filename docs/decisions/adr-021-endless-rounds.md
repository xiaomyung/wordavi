---
title: An endless round alongside fixed ones
date: 2026-07-25
---

## Context
Fixed rounds of 10, 20 or 30 questions give a session a shape and an end. But some practice is open-ended: a few minutes on the bus, stopping when the stop arrives rather than when a counter runs out.

## Decision
Add an endless option to the round-size stepper, shown as ∞. An endless round counts upwards instead of showing progress towards a total, has no progress bar, and produces a normal summary when the learner closes it.

## Why
The alternative — a very large fixed round — lies about the end and makes the progress bar meaningless. Counting up is honest about there being no finish line, and reusing the ordinary summary means the score, the misses and the retry all behave exactly as they do elsewhere.

## Consequences
Every place that reasoned about "questions remaining" has to handle the absent total, which is why the round size is a number *or* the endless marker rather than a sentinel like zero. The daily goal and the SRS are unaffected: both count answers, not rounds.
