#!/usr/bin/env bash
# Rasterise the app icons from their SVG sources into public/icons/.
#
# The PNGs are committed, so this is a development tool rather than a build step:
# nothing in CI or in the Docker image runs it. Run it after editing anything in
# design/icons/ (or public/favicon.svg) and commit what changes.
#
# Needs rsvg-convert (librsvg). On Arch: pacman -S librsvg.
#
# Usage: scripts/build-icons.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO/design/icons"
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

# Manifest "any": shown as drawn, corners included.
render "$SRC/icon.svg" 192 icon-192.png
render "$SRC/icon.svg" 512 icon-512.png

# Manifest "maskable": the launcher cuts its own shape out of this one.
render "$SRC/icon-maskable.svg" 192 icon-maskable-192.png
render "$SRC/icon-maskable.svg" 512 icon-maskable-512.png

# Browser tab favicons, from the standalone mark the tab already links to.
render "$REPO/public/favicon.svg" 16 favicon-16.png
render "$REPO/public/favicon.svg" 32 favicon-32.png
