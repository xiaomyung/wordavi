---
title: Obsidian vault published with Quartz
date: 2026-07-24
---

## Context
Project documentation needs to be public, versioned alongside the code, and readable both in an editor and on the web.

## Decision
Keep documentation as an Obsidian vault under `docs/` in the repo, published as a static site via Quartz on a docs subdomain, written in English and sanitized for public consumption.

## Why
Obsidian's local-first Markdown and wikilinks make notes easy to write and cross-reference without extra tooling, and Quartz turns the same vault into a public site with no separate CMS.

## Consequences
Notes must avoid internal infrastructure details such as hostnames, paths, and credentials, since the vault is public. See [[adr-017-shared-edge-proxy]] for how the docs site itself is routed.
