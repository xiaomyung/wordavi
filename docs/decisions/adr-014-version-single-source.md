---
title: package.json as the single version source
date: 2026-07-24
---

## Context
The footer, Docker image tags, and CI all need a consistent version number.

## Decision
Source the version from `package.json` only, shown in the app footer. CI gates every PR on a version increase. There are no git tags or GitHub releases.

## Why
A single source avoids drift between what's displayed and what's deployed. Docker image tags (`{version}`, `sha-`, `latest`) already give rollback capability, making separate tags or releases redundant.

## Consequences
Every PR to master must bump `package.json`'s version or CI fails. See [[adr-015-docker-nginx-unprivileged]] for how the version feeds into image tags.
