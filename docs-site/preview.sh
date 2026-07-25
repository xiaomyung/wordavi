#!/usr/bin/env bash
# On-demand local preview of the docs site. Runs until Ctrl+C, then frees the port.
# First run clones Quartz into ~/.cache/wordavi-quartz (~1 min); later runs start in seconds.
# Note: serves a snapshot of docs/ - rerun after editing to see changes.
# Usage: docs-site/preview.sh [port]   (default 8080)
set -euo pipefail
QUARTZ_REF=v4.5.2
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/wordavi-quartz"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8080}"

if [ ! -d "$CACHE" ]; then
  git clone --depth 1 --branch "$QUARTZ_REF" https://github.com/jackyzha0/quartz.git "$CACHE"
  (cd "$CACHE" && npm ci)
fi
cp "$REPO/docs-site/quartz.config.ts" "$REPO/docs-site/quartz.layout.ts" "$CACHE/"
# patched graph script, shadowing the clone's copy - see docs-site/README.md
cp "$REPO/docs-site/quartz/components/scripts/graph.inline.ts" \
  "$CACHE/quartz/components/scripts/graph.inline.ts"
rm -rf "$CACHE/content"
cp -r "$REPO/docs" "$CACHE/content"
cd "$CACHE" && npx quartz build --serve --port "$PORT"
