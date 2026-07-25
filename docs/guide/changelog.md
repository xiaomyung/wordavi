---
title: Changelog
---

For what wordavi does today from a learner's point of view, see the [[user-guide]]. Release history follows.

## 0.2.4 - 2026-07-25

- Answers count towards the daily goal the moment you give them. A round left
  part-played used to count for nothing at all, which made the goal look like it
  ignored the single modes — the ones you dip into and leave.
- Changing the number range now applies to a round you have already started. Come
  back to a round you left and the question waiting for you is inside the new
  range, as is everything after it; a number you missed under a wider range stops
  coming back while a narrower one is set.
- The installed icon reads at the same size as the mark inside the app. It was
  framed against the whole image rather than the part a phone actually shows, so
  it came out about a quarter too large on the home screen.
- The documentation site stops handing different builds to different visitors.
  Its scripts asked not to be cached with a directive that still allows a copy to
  be kept, so the edge held two builds of the same file at once and answered from
  whichever one a request happened to match.

## 0.2.3 - 2026-07-25

- The documentation site stops serving one build's scripts alongside another
  build's pages: nothing it publishes is fingerprinted, so nothing but the fonts
  is cached by URL any more.

## 0.2.2 - 2026-07-25

- The documentation's graph view no longer prints one note's title over another:
  the captions settle into place around their dots, and a caption that cannot
  fit waits for you to hover its dot rather than colliding.
- The published documentation site gets its graph, explorer and search back. They
  had never worked there: the browser refused the whole script bundle, so every
  page rendered with dead navigation while a local preview looked fine.

## 0.2.1 - 2026-07-25

- The documentation now has a development note: the commands, the repo layout, and
  the test-suite behaviour that is easy to get wrong. The readme is for learners
  again, screenshots and all.
- The app mark is now drawn at one scale everywhere — the favicon, the installed
  icons and the tile in onboarding all match the maskable icon's framing.
- A report with a screenshot now says up front when the screenshot cannot travel
  with the message, instead of dropping it silently on the way to the mail app.
- The component gallery is a development surface again: it is no longer part of
  the published build.
- The documentation's graph view is legible: the notes are spread out instead of
  piled in the middle, hovering one dims the rest, and the titles now move out of
  each other's way instead of printing on top of one another.
- The score chip in a drill no longer runs its number into the word after it.

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
