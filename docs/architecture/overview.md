---
title: Architecture overview
---

## What wordavi is, technically

wordavi is a mobile-first Progressive Web App that teaches Spanish (es-ES)
numbers: integers, decimals, euro prices, and grocery quantities. This note
describes the shape of the system. For the domain grammar it teaches, see
[[spanish-number-rules]].

The whole app is a **pure static site**:

- **React + Vite**, compiled ahead of time to plain HTML, CSS, and JavaScript.
- **No backend.** No API, no database, no server-side rendering, no accounts.
  Every feature runs in the browser.
- **All state lives on the device**, in `localStorage`. See [[storage-schema]].
- **Offline-first PWA.** Everything is precached by a service worker, so the app
  opens and works with no network. The one online-only feature - spoken answers,
  which the browser transcribes on its vendor's servers - pauses with an
  explanation instead of failing silently.
- **Served as static files** by nginx inside a small container. Nothing is
  computed per request.

Because there is no server logic, the interesting engineering is entirely in
the client: a pure number-grammar engine, a session/SRS layer, a pluggable set
of learning modes, and the screens that present them. That structure is
described in [[layers]] and [[mode-registry]].

## What ships today

**v0.2.0 ships the learning app**: six practice modes plus a mixed round, the
number-grammar engine, light spaced repetition, a daily goal with streaks,
onboarding, statistics, settings, backup and restore, and a problem report — all
of it offline-capable and installable. What each note describes is what the code
does; where a note still says "planned", the plan is genuinely unbuilt.

| Area | Status |
| --- | --- |
| Static build, version in footer | **Exists** |
| CI gates, image build, deploy pipeline, edge proxy | **Exists** — see [[pipeline]] |
| Number-grammar engine and matcher | **Exists** — see [[spanish-number-rules]] |
| Session / light SRS / scoring | **Exists** |
| Learning modes and the mode registry | **Exists** — see [[mode-registry]] |
| Storage schema, migrations, error buffer | **Exists** — see [[storage-schema]] |
| Offline precache, i18n (RU/EN/ES) | **Exists** — full precache, prompt-to-reload updates |
| Account sync across devices | **Not planned** — see [[adr-004-static-no-backend]] |

The engine and storage shapes were specified before they were written, because
they are the load-bearing decisions: everything above them assumes an answer can
be judged and progress can be trusted. That order paid off — the UI was built
against a settled engine rather than negotiating with it.

## How a request flows

A first visit travels the full path from browser to container:

1. The browser requests `wordavi.com`. DNS resolves to **Cloudflare**, which
   proxies the request (orange-cloud) and terminates TLS at the edge.
2. Cloudflare forwards to the **edge proxy** on the VPS over an origin
   certificate (Full strict). The origin firewall only accepts connections from
   Cloudflare's address ranges.
3. The edge proxy reverse-proxies the hostname to the **wordavi container**,
   which is nginx listening on port 8080 with no published host ports.
4. nginx returns the static build: a no-cache `index.html`, immutable
   fingerprinted `/assets/`, the service worker, and the web manifest.

On repeat visits the **service worker** answers from cache, so the app loads
instantly and works offline; the network is only touched to check for updates
and for online-only features. How the container itself is built, tagged, and
pulled onto the VPS is covered in [[pipeline]].

## Where to go next

- [[layers]] — the internal layering and the import rules that enforce it.
- [[mode-registry]] — how learning modes plug in, and how future subjects extend
  the app.
- [[spanish-number-rules]] — the Spanish grammar the engine encodes.
- [[storage-schema]] — how progress and settings persist on the device.
- [[pipeline]] — how a merge becomes a running container.
- [[decisions/index|decision records]] — the reasoning behind each of these choices, one ADR at a time.
