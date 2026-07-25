---
title: react-i18next for the interface languages
date: 2026-07-24
---

## Context
The interface needs more than one language, while the learning target language (es-ES) is fixed and never user-selectable. Russian and English shipped first; Spanish followed in 0.2.0 — see [[adr-019-es-ui-language]].

## Decision
Use react-i18next with bundled RU and EN locale files and typed translation keys. The engine emits keys, not literal strings, so UI language stays decoupled from learning content.

## Why
Bundling avoids a runtime fetch for translations, keeping offline support intact per [[adr-011-pwa-full-offline]]. Typed keys catch missing translations at compile time, and keeping the engine string-free avoids leaking UI language into pure logic.

## Consequences
Every new UI string needs a key in both locale files. See [[adr-001-react-vite-typescript]] for the strict typing this relies on.
