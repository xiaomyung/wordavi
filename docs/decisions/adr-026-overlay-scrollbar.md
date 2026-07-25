---
title: A custom overlay scrollbar instead of the platform one
date: 2026-07-25
---

## Context
On Linux and Windows, desktop Chrome draws a classic scrollbar with arrow buttons that occupies a real column of layout — measured at 15px. It appears when a screen overflows and vanishes when it does not, so moving between screens shifted the content sideways. It also looked nothing like the rest of the app.

## Decision
Hide the native scrollbar on the app's scroll regions and draw our own: a thin, token-coloured thumb positioned over the content, fading in while the learner scrolls, hovers or drags it, and fading out after a short idle. Native scrolling — wheel, touch, keyboard — is untouched.

## Why
A restyled native scrollbar still consumes its column, so restyling could not fix the layout shift; an overlay can. Reserving a permanent gutter instead would have avoided the shift at the cost of an off-centre column on every screen forever.

## Consequences
The thumb is a pointer-only control: it is too narrow to be a touch target, which is fine because touch users scroll the content directly. The overlay is measured rather than assumed — a test asserts the scroller's client and offset widths are equal while content overflows, and that content sits at an identical position whether the thumb is visible or not. Note that a headless browser hides scrollbars by default, so such a test must explicitly ask for real ones or it passes for the wrong reason.
