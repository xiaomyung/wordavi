---
title: Spanish as a third interface language, chosen by the device
date: 2026-07-25
---

## Context
The app was built for a Russian speaker living in Spain, with English as the fallback for everyone else. But a learner who already reads some Spanish gets more out of a Spanish interface, and the first screen a new user sees should not be in a language they cannot read.

## Decision
Ship three interface languages — Russian, English and Spanish — and pick the first one from the browser's language list, falling back to English when none of the three matches. Persist that choice at first boot, then let onboarding's second step change it.

## Why
Guessing from the device is right far more often than defaulting to the author's language, and it costs one read of `navigator.languages`. English rather than Russian as the fallback because a stranger who lands on the site is likelier to read English. Spanish is also the immersion option: the interface and the material become the same language.

## Consequences
Every user-facing string needs three translations, and a test asserts the three resource files have identical key sets, including the plural families each language needs (Russian has three). The engine and the modes emit keys rather than text, so nothing in the domain layers has to know a language exists — see [[adr-012-react-i18next]] and [[layers]].
