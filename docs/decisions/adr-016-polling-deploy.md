---
title: Polling deploy over push or webhook
date: 2026-07-24
---

## Context
The VPS exposes no inbound access for deploy triggers, and the app needs to pick up new images automatically.

## Decision
Use a systemd timer that runs an update script every 5 minutes (`docker compose pull` plus `up`), instead of Watchtower, SSH-push, or a webhook.

## Why
Polling needs no inbound port and no long-running privileged container. Watchtower was rejected for needing a root container with docker.sock access and for leaving updates in an unclear maintenance state.

## Consequences
Deploys land within 5 minutes of a published image rather than instantly. See [[adr-015-docker-nginx-unprivileged]] for what gets pulled and [[adr-017-shared-edge-proxy]] for the network these containers join.
