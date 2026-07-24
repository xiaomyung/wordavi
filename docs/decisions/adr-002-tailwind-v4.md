---
title: Tailwind v4 CSS-first tokens
date: 2026-07-24
---

## Context
The app needs consistent light/dark theming today and a clean path to a full visual redesign later.

## Decision
Use Tailwind v4 with CSS-first `@theme` tokens and the class-based dark mode strategy.

## Why
v4's CSS-first config keeps design tokens in one place, so a future redesign can re-skin the app by editing tokens instead of hunting through components; class-based dark mode allows explicit control instead of relying only on system preference.

## Consequences
Components should reference theme tokens rather than raw values. See [[adr-001-react-vite-typescript]] for the surrounding stack and [[adr-011-pwa-full-offline]] for how theming behaves across offline states.
