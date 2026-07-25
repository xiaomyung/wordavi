---
title: wordavi
---

wordavi is a mobile-first PWA for learning how numbers work in Spanish — counting, decimals, prices, and grocery quantities — built around the kind of number-sense a Spanish speaker uses every day without thinking about it.

## Start here

- **Using the app** → [[user-guide]]. The six practice modes, how a round works,
  what your data does and does not do, and how to get your progress onto another
  phone.
- **Understanding the code** → [[overview]] for the shape of the system, then
  [[layers]] for the dependency rules it is built on.
- **Running it in production** → [[runbook]] for day-to-day operations, or
  [[pipeline]] for how a merge becomes a running container.
- **Why something is the way it is** → [[decisions/index|the decision records]].

## Everything else

| Note | What it covers |
| --- | --- |
| [[spanish-number-rules]] | the es-ES grammar the engine encodes, and what it deliberately rejects |
| [[mode-registry]] | the contract a practice mode implements, and the six that ship |
| [[storage-schema]] | what is kept on the device, how it is guarded, and how it migrates |
| [[deployment]] | the containers, the private network, and the proxy in front of them |
| [[cloudflare]] | DNS and certificate setup |
| [[changelog]] | what shipped, release by release |
