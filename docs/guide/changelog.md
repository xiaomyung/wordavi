---
title: Changelog
---

For what wordavi does today from a learner's point of view, see the [[user-guide]]. Release history follows.

## 0.2.1 - 2026-07-25

- Documented the development commands in the readme, which had none, and dropped
  its stale "work in progress" status.
- The app mark is now drawn at one scale everywhere — the favicon, the installed
  icons and the tile in onboarding all match the maskable icon's framing.

## 0.2.0 - 2026-07-25

The learning app itself, replacing the in-progress page.

- **Six practice modes**: read a numeral in Spanish, type what you hear as
  digits, listen and write, pick the right numeral, say it out loud, and
  grocery prices and weights. The big button plays a mixed round drawn from
  every mode your device can run.
- **Rounds** of 10, 20, 30 or endless, with a score, a combo counter and a
  forgiving verdict: an answer that differs only by an accent counts as
  "almost" and keeps your combo.
- **Light spaced repetition** — thirteen skill buckets and a queue of recent
  misses, so what you get wrong comes back until it sticks. A missed question
  only ever returns in a mode that can present it.
- **Daily goal and streaks**, a statistics screen with per-skill accuracy, and a
  round you can leave mid-way and resume exactly where it stood.
- **Onboarding** that offers to install the app first, then picks up the
  language your phone already uses (Russian, English or Spanish).
- **Install, backup and restore**: save your progress to a file and load it
  back, and report a problem with diagnostics attached.
- Works fully offline once installed; the voice modes explain themselves rather
  than failing when there is no network or no Spanish voice.
- Soft feedback sounds, haptics, light and dark themes that follow the system,
  and a scrollbar that never shifts the layout.

## 0.1.3 - 2026-07-24

- Internal code cleanup.
- Docs site: working explorer, graph and search; self-hosted fonts.

## 0.1.2 - 2026-07-24

- Automatic deployment pipeline verified end to end.
- Language tagging for the Spanish sample line.

## 0.1.1 - 2026-07-24

- Build fixes for the container image pipeline.

## 0.1.0 - 2026-07-24

- Project scaffold: React, Vite, TypeScript, and Tailwind set up as the foundation for the app.
- Bilingual (Russian/English) in-progress page shown while the full app is being built.
- CI pipeline with quality gates: tests, linting, and a version-bump check on every pull request.
- Containerized deployment with automatic updates.
- Documentation site published alongside the app.
