# wordavi

Learn Spanish numbers — integers, decimals, prices, and grocery quantities. Built for real-life situations like understanding a cashier or weighing produce.

Live at [wordavi.com](https://wordavi.com) · Docs at [docs.wordavi.com](https://docs.wordavi.com)

A mobile-first PWA: six practice modes plus a mixed round, forgiving answer matching, light spaced repetition, a daily goal with streaks, and full offline support once installed. No accounts, no backend, no tracking — everything lives on the device. See the [user guide](https://docs.wordavi.com/guide/user-guide) for what it does, or the [architecture overview](https://docs.wordavi.com/architecture/overview) for how it is built.

## Development

Requires Node 22+ and [pnpm](https://pnpm.io). If pnpm lives outside your `PATH` (a standalone install puts it in `~/.local/share/pnpm`), add it before running anything.

```bash
pnpm install
pnpm dev                     # http://localhost:5173
pnpm dev --host              # also on the LAN, e.g. http://192.168.1.20:5173 — open that on a phone
pnpm dev --port 3000         # if 5173 is taken
```

`--host` prints every address it is listening on; the one that is not `localhost` is what a phone on the same wifi can reach. Note that a LAN address over plain `http://` is not a secure origin, so installing the app, the clipboard and Web Share stay unavailable there — use `localhost` or the live site for those.

| Command | What it does |
| --- | --- |
| `pnpm dev` | dev server with hot reload on :5173 (`--host` to expose it on the LAN) |
| `pnpm verify` | lint, typecheck, unit tests and build — **run this before pushing** |
| `pnpm test` | Vitest once; `pnpm test:watch` to keep it running |
| `pnpm e2e` | Playwright, on an emulated phone and desktop Chrome |
| `pnpm lint` | Biome check; `pnpm lint:fix` to apply what it can |
| `pnpm typecheck` | `tsc` with no emit |
| `pnpm build` | production build into `dist/` |
| `pnpm preview` | serve the built `dist/` on :4173 (`--host` works here too) |
| `pnpm docs:preview` | build and serve the docs site locally on :8080 |

One-time, before the first `pnpm e2e`:

```bash
pnpm exec playwright install chromium
```

### Things worth knowing before you run the suites

`pnpm e2e` serves `dist/` as it is on disk, so build first (`pnpm verify` does) or you will be testing the previous build.

Visual baselines are committed and are checked on the mobile project only. Glyph rasterisation differs between machines, so they are skipped in CI unless `VISUAL=1`. After an intentional design change, regenerate them with `--update-snapshots=all` — plain `--update-snapshots` leaves a baseline alone when the difference falls under the configured pixel tolerance, which quietly keeps a stale image while the test passes.

Some browser features need a secure origin: installing the app, the clipboard, and Web Share all refuse to work over `http://` on a LAN address. Use `localhost` for those, or the live site.

### Layout

```
src/engine      pure es-ES number grammar — no React, no browser
src/session     rounds, spaced repetition, scoring — pure state transitions
src/storage     localStorage with shape guards and migrations
src/services    speech, sounds, haptics, install, PWA update
src/components  presentational only, styled from tokens
src/modes       one module per practice mode, registered in modes/index.ts
src/screens     full-page compositions
src/app         shell, screen state, persistence
docs/           the vault published at docs.wordavi.com
```

Those boundaries are enforced by `tests/architecture.test.ts`, which reads every import and fails on a banned one or a cycle. Every colour resolves from `src/styles/tokens.css`; a test fails if a hex value appears anywhere else. The reasoning is in [layers](https://docs.wordavi.com/architecture/layers).

## License

[MIT](LICENSE)
