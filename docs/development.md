---
title: Development
---

Everything needed to run wordavi locally, and the handful of things about the
test suites that are worth knowing before they surprise you. For what the app
does, see [[user-guide]]; for how it is put together, [[overview]].

## Prerequisites

Node 22 or newer and [pnpm](https://pnpm.io). A standalone pnpm install lands in
`~/.local/share/pnpm`, which is not always on `PATH` — add it before running
anything, or every command below will report "command not found".

```bash
pnpm install
```

## Running the app

```bash
pnpm dev                     # http://localhost:5173
pnpm dev --host              # also on the LAN, e.g. http://192.168.1.20:5173
pnpm dev --port 3000         # if 5173 is taken
```

`--host` prints every address it is listening on. The one that is not
`localhost` is what a phone on the same wifi can open, which is the only way to
feel the layout on a real device.

One caveat that costs an hour if you do not know it: a LAN address over plain
`http://` is **not a secure origin**, so installing the app, the clipboard and
Web Share all refuse to work there. Chrome will say the page is not served from
a secure origin. Use `localhost` (which counts as secure) or the live site when
testing those.

## Running the docs site

```bash
pnpm docs:preview            # http://localhost:8080
pnpm docs:preview 3000       # on another port
```

This builds a **snapshot** of `docs/` with Quartz and serves it, so rerun the
command after editing a note. The first run clones Quartz into
`~/.cache/wordavi-quartz` and installs it, which takes about a minute; later runs
start in seconds.

Quartz is not vendored, but one of its files is patched:
`docs-site/quartz/components/scripts/graph.inline.ts`, a copy of Quartz's graph
script kept at the path it has upstream. Both the preview script and the image
build copy it over the clone's own copy. It makes the graph's captions resolve
their own overlap — upstream pins each caption above its node and lets them
collide, which forty notes with long titles turn into a smear, and no amount of
force tuning helps because the simulation only separates node points. The patch
fits the caption boxes apart once the layout settles, and hides a caption that
still will not fit rather than floating it away from its dot; hovering a node
always shows its own caption. Bumping `QUARTZ_REF` means re-applying two marked
blocks — `docs-site/README.md` has the recipe, and the console snippet that
checks no two captions overlap.

## The commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | dev server with hot reload on :5173 |
| `pnpm verify` | lint, typecheck, unit tests and build — **run this before pushing** |
| `pnpm test` | Vitest once |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm e2e` | Playwright, on an emulated phone and desktop Chrome — builds first |
| `pnpm lint` | Biome check |
| `pnpm lint:fix` | Biome check, applying what it can fix |
| `pnpm typecheck` | `tsc` with no emit |
| `pnpm build` | production build into `dist/` |
| `pnpm build:e2e` | the same build plus the component gallery, which three specs need |
| `pnpm preview` | serve the built `dist/` on :4173 |
| `pnpm docs:preview` | build and serve this documentation site on :8080 |

`pnpm verify` is what CI's gates add up to, so a green `verify` plus a green
`pnpm e2e` means the pull request will pass. See [[pipeline]] for the gates
themselves.

Before the first `pnpm e2e`, install the browser once:

```bash
pnpm exec playwright install chromium
```

## Things the test suites will not tell you

**`pnpm e2e` builds first; driving Playwright yourself does not.** The script
runs `pnpm build:e2e` and then the suite, so `pnpm e2e` always tests your current
code. But calling `pnpm exec playwright test …` directly — which is what you do to
regenerate a baseline or run one spec — serves `dist/` exactly as it is on disk.
Run `pnpm build:e2e` first, or you are testing the previous build and wondering
why your change had no effect.

**Visual baselines need `--update-snapshots=all`.** The committed baselines live
in `e2e/visual.spec.ts-snapshots/` and are compared with a one-percent pixel
tolerance. A small change — a label, a tick, an icon — falls under that
tolerance, so the run passes *and* plain `--update-snapshots` leaves the old
image in place. The result is a committed screenshot that no longer matches the
app while every test is green. After an intentional design change:

```bash
pnpm build:e2e
pnpm exec playwright test e2e/visual.spec.ts --project=mobile --update-snapshots=all
```

**Baselines are mobile-only and skipped in CI.** Glyph rasterisation differs
between machines, so a runner that did not generate the PNGs would report diffs
that mean nothing. They run in CI only when `VISUAL=1` says the baselines belong
to that machine.

**Unit tests run with a worker cap.** `vitest.config`'s `maxWorkers: 2` is
deliberate: the suite is large and an unbounded fork pool will exhaust memory on
a normal laptop.

## The readme's screenshots

They live in `docs/assets/screenshots/` and are generated, not taken by hand:

```bash
SHOTS=1 pnpm exec playwright test e2e/screenshots.spec.ts --project=mobile
```

That spec skips itself without `SHOTS=1`, because it writes into the working
tree. It seeds the state rather than playing it — a frozen clock, fixed seeds,
reduced motion, and an English interface — so rerunning it reproduces the same
four images instead of whatever today's random numerals happen to be.

## The app icons

The PNGs in `public/icons/` are generated, and committed:

```bash
icons/build.sh                  # needs rsvg-convert (librsvg)
```

Nothing in CI or in the Docker image runs it — the image build never sees
`icons/` at all, since `.dockerignore` allows only what the app needs. Run it
after editing either SVG source and commit what changes.

There are only two sources, in two places for a reason. **`public/favicon.svg`**
is shipped as it is (`index.html` links it), and the tab favicons and the `any`
manifest icons are the same drawing, so they are rendered straight from it rather
than from a second copy that could drift. **`icons/icon-maskable.svg`** is the
one variant that needs artwork of its own, and it stays outside `public/` because
`vite.config.ts` precaches `**/*.svg` — a source in there would be downloaded by
every user.

The two are deliberately framed differently. The shipped mark is shown as drawn,
so it carries its own rounded corners and sits at 0.625 of the canvas. The
maskable one is cropped by the launcher to a shape of its choosing, of which only
the central 80% is guaranteed, so it bleeds to every edge and the mark sits at
0.5 — which is that same 0.625, measured against what is
actually shown. `tests/icons.test.ts` holds the rule, because the crop happens on
the phone and the file looks fine either way. See
[[adr-029-maskable-icon-safe-zone]].

## The component gallery

`/?gallery=1` opens a page holding every component in every state — the surface a
design review reads next to the mockups. It is not a feature, and it is not in
the live site: a build carries it only when `WORDAVI_GALLERY=1` asks for it, which
`pnpm build:e2e` sets and `pnpm build` does not. `pnpm dev` and the unit runs
always have it.

The switch is thrown when the bundle is built, so nothing in a browser can flip
it — the shipped bundle contains neither the gallery's code nor the branch that
would load it, and CI fails the pull request if a production build ever emits the
gallery chunk.

## Layout

```
src/engine      pure es-ES number grammar — no React, no browser, no storage
src/session     rounds, spaced repetition, scoring — pure state transitions
src/storage     localStorage with shape guards and migrations
src/services    speech, sounds, haptics, install, PWA update
src/components  presentational only, styled from tokens
src/modes       one module per practice mode, registered in modes/index.ts
src/screens     full-page compositions
src/app         shell, screen state, persistence, wiring
docs/           this vault, published at docs.wordavi.com
```

Those boundaries are not advisory: `tests/architecture.test.ts` reads every
import under `src/` and fails on a banned one or a cycle. Every colour resolves
from `src/styles/tokens.css`, and a test fails if a hex value appears anywhere
else. The reasoning is in [[layers]].

## Conventions

Every pull request bumps the version in `package.json` — CI refuses one that
does not, because the version is what a rollback pins to
([[adr-014-version-single-source]]). Every release gets a [[changelog]] entry,
and a change that makes a note here stale is expected to fix the note in the
same pull request.
