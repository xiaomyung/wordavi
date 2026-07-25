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
- **Offline-first PWA.** The shell and assets are precached by a service
  worker, so the app opens and works with no network. The few online-only
  features (voice recognition, speech synthesis voices) degrade with a friendly
  toast instead of failing silently.
- **Served as static files** by nginx inside a small container. Nothing is
  computed per request.

Because there is no server logic, the interesting engineering is entirely in
the client: a pure number-grammar engine, a session/SRS layer, a pluggable set
of learning modes, and the screens that present them. That structure is
described in [[layers]] and [[mode-registry]].

## Current status vs the committed plan

**v0.1.0 ships only an "in progress" page** — a bilingual (EN/RU) coming-soon
screen with the version in the footer. The layered architecture across these
notes is the **committed plan for v1**, being built behind that page. A full
build follows a dedicated design phase.

Each note marks what exists today versus what is planned. At a glance:

| Area | Status |
| --- | --- |
| Static build, coming-soon page, version in footer | **Exists** |
| CI gates, image build, deploy pipeline, edge proxy | **Exists** — see [[pipeline]] |
| Number-grammar engine and matcher | **Planned** — spec'd in [[spanish-number-rules]] |
| Session / light SRS / scoring | **Planned** |
| Learning modes and the mode registry | **Planned** — see [[mode-registry]] |
| Storage schema, migrations, error buffer | **Planned** — spec'd in [[storage-schema]] |
| Offline precache, i18n (RU/EN) | **Exists** — full precache, prompt-to-reload updates |

Writing these specs before the code is deliberate: the engine and storage
shapes are the load-bearing decisions, and they are locked here so the later
UI work is free to move fast without re-litigating them.

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
