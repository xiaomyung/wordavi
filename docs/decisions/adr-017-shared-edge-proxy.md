---
title: One shared edge proxy for multiple apps
date: 2026-07-24
---

## Context
The VPS hosts more than one app behind TLS, and each app container shouldn't need to manage its own certificates or public port.

## Decision
Run one shared Caddy edge compose stack on an external Docker network. App containers, including wordavi and its docs site, join that network without publishing any ports themselves. TLS uses Cloudflare Origin Certificates with Full (strict) mode behind Cloudflare's proxy.

## Why
Centralizing routing and TLS in one edge proxy avoids duplicating certificate management per app. Cloudflare Origin Certificates pair naturally with Full (strict), and since Cloudflare's proxy already sits in front of the origin, ACME wasn't needed.

## Consequences
The origin firewall only needs to allow Cloudflare's IP ranges on 80/443. Adding a new app means adding a route to the edge Caddyfile, not a new exposed port. See [[adr-016-polling-deploy]] for how containers on this network get updated.
