---
title: Runbook
---

Day-to-day operation of wordavi in production: how deploys reach the VPS on their own, how to pin or roll back a version, how to check that a container is healthy, and where to find logs.

See also [[deployment]] for the architecture this runbook operates, and [[cloudflare]] for the DNS and TLS layer in front of it.

## How a deploy happens

Deploys are fully automatic. There is no manual step between merging and shipping.

1. A pull request is merged to `master`.
2. CI builds the Docker image and pushes it to the registry (GHCR), tagged three ways: the version from `package.json` (for example `0.1.0`), a `sha-<commit>` tag, and `latest`.
3. On the VPS, a systemd timer fires every five minutes and runs the update script.
4. The update script pulls the tags the Compose project resolves to and runs `docker compose up -d`. If an image digest actually changed, the affected container restarts on the new image; if nothing changed, nothing happens.

Net effect: a merge is live within roughly five minutes, and a run that finds no new image is a no-op.

## What the update timer does

The timer is a `oneshot` systemd unit on the VPS:

- Schedule: every five minutes (`OnCalendar=*:0/5`), plus a small randomized delay so pulls don't all land on the exact minute.
- `Persistent=true`, so a missed run (VPS was down) is caught up on next boot.
- The script it runs is idempotent — it records the running image before and after `pull` + `up -d`, restarts only containers whose image genuinely changed, and prunes dangling images afterward.

To watch or trigger it manually from the VPS:

```bash
systemctl status  wordavi-pull.timer
systemctl list-timers wordavi-pull.timer
sudo systemctl start wordavi-pull.service   # run one update cycle now
```

## Pin or roll back a version

Every release stays available under an immutable version tag (for example `0.1.0`) and a `sha-<commit>` tag, so rollback is just choosing a tag.

The Compose file reads the app image tag from `IMAGE_TAG` (defaulting to `latest`) and the docs image tag from `DOCS_TAG`. To pin, set the tag in the Compose project's `.env` file and re-apply:

```bash
# in the wordavi compose directory on the VPS
echo "IMAGE_TAG=0.1.0" >> .env
docker compose up -d
```

Because the update timer pulls whatever `.env` resolves to, a pin is durable: the automatic updater keeps you on `0.1.0` and will not move you forward until the pin is removed. To resume rolling updates:

```bash
# remove the IMAGE_TAG line from .env (or set it back to latest), then:
docker compose up -d
```

The docs container is pinned the same way with `DOCS_TAG`.

## Check container health

Each container has a built-in health check that polls its `/healthz` endpoint every 30 seconds.

```bash
# in the wordavi compose directory on the VPS
docker compose ps                       # STATUS column shows healthy / unhealthy
docker inspect --format '{{.State.Health.Status}}' <container>
```

There are no published ports — the containers are reachable only from inside the shared `edge` network (via the edge proxy), not on the VPS's public interface. To probe the app from another container on that network:

```bash
curl -s http://wordavi:8080/healthz     # returns: ok
```

## Where the logs are

Containers use the `json-file` log driver, rotated at 10 MB per file, three files kept, per container.

```bash
# in the wordavi compose directory on the VPS
docker compose logs -f app              # follow the app
docker compose logs --tail=200 docs     # last 200 lines of the docs site
docker logs <container>                 # by container name or id
```

For edge-level issues (TLS, routing, redirects), the relevant logs are the edge proxy's own container logs rather than the app's — see [[deployment]].
