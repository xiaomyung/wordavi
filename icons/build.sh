#!/usr/bin/env bash
# Rasterise the app icons into public/icons/.
#
# There are two SVG sources and they sit in different places on purpose.
# public/favicon.svg is shipped as-is (index.html links it), and the tab
# favicons and the "any" manifest icons are the same drawing, so they are
# rendered straight from it rather than from a second copy that could drift.
# Only the maskable variant needs artwork of its own — a launcher crops it — and
# that one lives here, beside this script, because it is never served directly.
# It cannot live in public/ either: vite precaches **/*.svg, so a source there
# would be downloaded by every user.
#
# The PNGs are committed, so this is a development tool rather than a build step:
# nothing in CI or in the Docker image runs it. Run it after editing either SVG
# and commit what changes.
#
# Needs rsvg-convert (librsvg). On Arch: pacman -S librsvg.
#
# Usage: icons/build.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO/icons"
OUT="$REPO/public/icons"

if ! command -v rsvg-convert >/dev/null; then
  echo "build-icons: rsvg-convert not found (install librsvg)" >&2
  exit 1
fi

render() { # <svg> <size> <png>
  rsvg-convert --width "$2" --height "$2" --output "$OUT/$3" "$1"
  echo "  $3 (${2}px)"
}

mkdir -p "$OUT"
echo "icons ->"

# Manifest "any": shown as drawn, corners included — the shipped mark itself.
render "$REPO/public/favicon.svg" 192 icon-192.png
render "$REPO/public/favicon.svg" 512 icon-512.png

# Manifest "maskable": the launcher cuts its own shape out of this one.
render "$SRC/icon-maskable.svg" 192 icon-maskable-192.png
render "$SRC/icon-maskable.svg" 512 icon-maskable-512.png

# Browser tab favicons, same drawing again.
render "$REPO/public/favicon.svg" 16 favicon-16.png
render "$REPO/public/favicon.svg" 32 favicon-32.png
