---
title: Versioned localStorage schema
date: 2026-07-24
---

## Context
The app needs durable local state (settings, SRS progress, error log) with no backend, plus a clean path to future account sync.

## Decision
Store state in localStorage under namespaced keys (`wordavi:v`, `:settings`, `:srs`, `:progress`, `:errors`), each shape-guarded on read, migrated sequentially, and stamped with `updatedAt`.

## Why
Namespacing avoids collisions with other scripts on the page; shape guards and sequential migrations let the schema evolve without corrupting existing users' data; `updatedAt` on every record prepares for a future sync/merge without a rewrite.

## Consequences
Any schema change needs a migration step, not just a type change. See [[adr-004-static-no-backend]] for why this is the only persistence layer, and [[adr-009-light-srs-buckets]] for what actually lives under `:srs`.
