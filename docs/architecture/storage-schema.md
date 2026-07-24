---
title: Storage schema
---

## Where state lives

wordavi has no backend and no accounts (see [[overview]]), so **all persistent
state is in `localStorage`** on the device. The `storage` layer
([[layers]]) is the only code that touches it; everything else goes through
typed helpers.

> **Status.** v0.1.0 persists nothing beyond what the browser caches for the
> PWA. The schema below is the **committed plan for v1** and is being built as
> the engine and session land. The shapes are locked now so later migrations
> have a clean starting point.

## Keys

All keys are namespaced under `wordavi:`.

| Key | Holds |
| --- | --- |
| `wordavi:v` | schema version number (integer) |
| `wordavi:settings` | UI language, range slider, decimals toggle, daily goal, theme override |
| `wordavi:srs` | the ~15 skill buckets and the `wrongQueue` |
| `wordavi:progress` | streaks, score, combo, daily-goal progress, session history counters |
| `wordavi:errors` | the error ring buffer (see below) |

Splitting into several keys (rather than one blob) keeps a corrupt or
oversized value — most likely `errors` — from taking the whole app down with it.

## Versioning and migrations

`wordavi:v` records the schema version the stored data was last written under.
On startup the storage layer compares it to the current code version and runs
**sequential migrations** to close the gap:

1. Read `wordavi:v`. If absent, treat as a fresh install at the current version.
2. While `stored < current`, apply the migration for `stored → stored + 1`,
   then bump `stored`.
3. Write back the migrated data and the new `wordavi:v`.

Migrations are small, ordered, and idempotent, so a user who skips several
releases is upgraded step by step through the same functions rather than via a
special "big jump" path. Each migration owns exactly one version transition.

## Shape-guarded reads

Every read is **validated before use**, never trusted because it parsed as JSON.
`localStorage` can hold anything a past bug, a hand-edit, or a half-finished
write left behind, so each read:

1. `JSON.parse` inside a try/catch.
2. Runs a shape guard (a narrow runtime check of the expected fields/types).
3. On any failure, falls back to a **known-good default** for that key and logs
   to the error buffer — the app keeps running with defaults rather than
   throwing.

This is why the keys are typed at the storage boundary: past that point the rest
of the app can assume well-formed data.

## `updatedAt` everywhere

Every stored record carries an **`updatedAt`** timestamp (ISO-8601). It is not
used by v1 today, and that is the point: it is written now so it exists in the
history when it is needed.

- **Future account sync.** v1 has no accounts, but they are on the roadmap. When
  sync arrives, `updatedAt` gives every record a last-write-wins (or smarter)
  merge key, so local data recorded long before sync existed can still be
  reconciled with a server without guessing which side is newer.
- **Debugging and migrations.** Timestamps make it possible to reason about
  stale data and to write migrations that key off recency.

Backfilling timestamps retroactively is impossible — the information is gone —
so they are captured from day one.

## Error ring buffer

`wordavi:errors` is a **fixed-size ring buffer** that underpins the "Report
problem" feature described in [[overview]].

- **Sources.** A global `window.onerror` / `unhandledrejection` hook and the
  React error boundary both push structured entries (message, stack, a little
  context, `updatedAt`).
- **Bounded.** The buffer caps at a small number of recent entries; the oldest
  is dropped when full, so error capture can never grow without limit or fill
  the origin's storage quota.
- **Export, not phone-home.** There is no server to send to. "Report problem"
  serialises the buffer and hands it to **Web Share** (or `mailto:` as a
  fallback) so the user chooses whether and where to send it. This keeps the app
  purely static and privacy-respecting.

## Relationship to the SRS

`wordavi:srs` stores the ~15 **skill buckets** (units, teens-fused,
twenties-fused, tens-`y`, hundreds regular/irregular, thousands, millions,
decimals, price-cents, quantities, …) plus the **`wrongQueue`** (capped at 50,
items resurfacing after 3 / 8 / 20 questions). Those bucket ids are the same
`Question.skill` values the modes emit — see [[mode-registry]] — which is what
lets a future subject reuse this storage shape unchanged.
