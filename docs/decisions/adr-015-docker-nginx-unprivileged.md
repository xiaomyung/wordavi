---
title: Multi-stage build on unprivileged nginx
date: 2026-07-24
---

## Context
The static build needs a small, secure production image.

## Decision
Use a multi-stage Dockerfile: build with node:26-alpine and pnpm, then serve with `nginxinc/nginx-unprivileged:1.29-alpine` on port 8080, including a healthz endpoint, SPA fallback, immutable caching for `/assets/`, no-cache for `index.html` and `sw.js`, and security headers with a self-only CSP.

## Why
Unprivileged nginx avoids running the container as root. The immutable/no-cache split lets hashed assets cache forever while the entry point always fetches fresh, which matters for the service worker update flow in [[adr-011-pwa-full-offline]].

## Consequences
Any new external resource needs an explicit CSP allowance since the policy defaults to self-only. Images are pushed to GHCR tagged per [[adr-014-version-single-source]].
