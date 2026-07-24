#!/usr/bin/env bash
# Pull the latest images and restart only if something changed.
# Usage: update.sh            - pull tags from .env (default: latest)
#        IMAGE_TAG=0.1.0 update.sh  - pin the app image for rollback
set -euo pipefail
cd /srv/wordavi

before=$(docker compose ps -q | xargs -r docker inspect --format '{{.Image}}' | sort)
docker compose pull -q
docker compose up -d
after=$(docker compose ps -q | xargs -r docker inspect --format '{{.Image}}' | sort)

if [ "$before" != "$after" ]; then
  echo "updated images:"
  diff <(echo "$before") <(echo "$after") || true
fi
docker image prune -f >/dev/null
