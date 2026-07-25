# docs-site

This directory holds the [Quartz v4](https://github.com/jackyzha0/quartz) configuration used to
publish the vault in `docs/` as a static documentation site.

Quartz itself is not vendored here — what lives in this repo is `quartz.config.ts`,
`quartz.layout.ts` and one patched Quartz source file (below). The site is built in CI by
`Dockerfile.docs`, which clones Quartz pinned to the `QUARTZ_REF` build argument (currently
`v4.5.2`), runs `npm ci`, copies those three files and the `docs/` vault (as `content/`) into the
clone, and runs `npx quartz build`.

## Preview locally

```bash
pnpm docs:preview
```

Then open http://localhost:8080. Ctrl+C stops the server and frees the port.

This runs `docs-site/preview.sh`, which serves a **snapshot** of `docs/` — rerun the command after
editing docs to see changes. The first run clones Quartz (pinned to `QUARTZ_REF` in the script,
currently `v4.5.2`) into `~/.cache/wordavi-quartz` and runs `npm ci`, which takes about a minute;
later runs reuse that cache and start in seconds. Pass a port as the first argument
(`docs-site/preview.sh 3000`) to override the default `8080`.

When bumping Quartz, update `QUARTZ_REF` in both `Dockerfile.docs` and `docs-site/preview.sh`
together, and re-apply the patch below.

## The patched graph script

`quartz/components/scripts/graph.inline.ts` is the one Quartz source file this repo carries a copy
of. It sits at the path it has upstream — `docs-site/quartz/components/scripts/graph.inline.ts` —
and both build paths copy it over the clone's own copy, so it shadows upstream. Nothing else in
Quartz is touched.

**Why.** Upstream pins every caption to a point above its node and lets the captions collide.
Tuning the d3 forces cannot fix that: the simulation separates node *points*, while a caption is a
wide rectangle. With forty notes, most of them decision records orbiting the same hub at the same
radius, titles like "Speech recognition as an optional, capability-gated mode" render as an
unreadable smear.

**What the patch does.** Once the layout settles it fits the caption rectangles apart — each
overlapping pair is pushed along its axis of least penetration, which for wide short boxes almost
always means stacking them vertically, so a caption stays above its own dot. A caption may not
travel further than two and a half of its own heights from its node; anything that still overlaps
after that is hidden rather than parked somewhere confusing, busiest nodes keeping their caption.
Hovering a node always shows its caption, hidden or not. Captions scale with the stage, so which
ones overlap does not depend on the zoom level and the fit is computed once per settle, not per
frame.

**Bumping `QUARTZ_REF`.** The patch is two blocks marked `wordavi 1/2` and `wordavi 2/2`, described
in the file's header comment, so re-applying it is mechanical:

1. Diff the new upstream `graph.inline.ts` against the one for the tag you are leaving.
2. Take the new upstream file as the base and re-apply the two marked blocks.
3. Update the tag named in the header comment.
4. Check the fit, below.

**Checking the fit.** Every caption is published as `window.__graphLabelBoxes` —
`{ text, hidden, x, y, width, height }` in graph coordinates, for whichever graph settled last.
Build and serve the site, open the global graph (the icon in the corner of the sidebar graph), let
it come to rest, and read both numbers in the console:

```js
const b = window.__graphLabelBoxes
const shown = b.filter((x) => !x.hidden)
shown.flatMap((a, i) =>
  shown.slice(i + 1).filter(
    (c) =>
      a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height && c.y < a.y + a.height,
  ),
).length // 0 — but this is guaranteed by construction, so it only catches a broken build
b.filter((x) => x.hidden).length // 0 on this vault; the number that moves if the fit degrades
```

Two shown captions can never intersect — the fit drops a caption rather than let that happen — so
the count above only tells you the script ran at all. What a bumped `QUARTZ_REF` can actually
regress is how many captions had to be dropped, which is the second number.

A plain static server over the built `public/` is enough, and is the easier way to drive this from
a browser automation: `quartz build --serve` wants port 3001 for its live-reload socket and exits
if something else holds it.
