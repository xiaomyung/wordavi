---
title: Pure static app, no backend in v1
date: 2026-07-24
---

## Context
v1 has no user accounts, and all learner state lives entirely in the browser.

## Decision
Ship wordavi as a pure static site with no backend service in v1.

## Why
Without accounts there is nothing for a backend to serve; static hosting is simpler to build, deploy, and cache, and it keeps the app fully usable offline by construction.

## Consequences
All persistence goes through [[adr-005-localstorage-versioned-schema]]. A backend gets introduced only when account sync becomes a real feature, not before.
