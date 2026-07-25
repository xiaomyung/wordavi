---
title: Four install affordances, because one is not enough
date: 2026-07-25
---

## Context
The app is worth installing: an installed copy opens from the home screen and works with no network. But there is no single way to offer that. Chrome fires `beforeinstallprompt` and can show a real dialog; iOS Safari has only the Share sheet; Brave and Firefox have neither, keeping installation in a browser menu. The target user has to install it herself, remotely, unaided.

## Decision
Model the invitation as four states and render whichever is true: **hidden** when the app is already installed or running standalone, **prompt** when a captured `beforeinstallprompt` lets us open the real dialog, **ios** when Safari needs the Share-sheet recipe, and **manual** otherwise — a plain description of where the browser hides it. Offer it as the first onboarding step, as a row in Settings, and as an invitation under the start button.

## Why
An install button that does nothing on a third of browsers is worse than an honest instruction. Detecting "already installed" via `getInstalledRelatedApps` (and the standalone display mode) keeps the invitation from nagging someone who already did it. Three placements rather than one because onboarding is skippable and Settings is where people go looking later.

## Consequences
The affordance has to re-evaluate at runtime: `beforeinstallprompt` can arrive after first paint, so a manual invitation upgrades itself to a real button when it does, and dismissing the dialog re-enables the row rather than leaving a dead control. Installation cannot be tested in a headless browser, so the four states are covered by unit tests that drive the detection directly.
