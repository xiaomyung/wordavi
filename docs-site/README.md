# docs-site

This directory holds the [Quartz v4](https://github.com/jackyzha0/quartz) configuration used to
publish the vault in `docs/` as a static documentation site.

Quartz itself is not vendored here — only `quartz.config.ts` and `quartz.layout.ts` live in this
repo. The site is built in CI by `Dockerfile.docs`, which clones Quartz pinned to the
`QUARTZ_REF` build argument (currently `v4.5.2`), runs `npm ci`, copies these two config files and
the `docs/` vault (as `content/`) into the clone, and runs `npx quartz build`.

## Preview locally

```bash
pnpm docs:preview
```

Then open http://localhost:8080. Ctrl+C stops the server and frees the port.

This runs `docs-site/preview.sh`, which serves a **snapshot** of `docs/` — rerun the command after
editing docs to see changes. The first run clones Quartz (pinned to `QUARTZ_REF` in the script,
currently `v4.5.2`) into `~/.cache/wordavi-quartz` and runs `npm ci`, which takes about a minute;
later runs reuse that cache and start in seconds. Pass a port as the first argument
(`docs-site/preview.sh 3000`) to override the default `8080`.

When bumping Quartz, update `QUARTZ_REF` in both `Dockerfile.docs` and `docs-site/preview.sh`
together.
