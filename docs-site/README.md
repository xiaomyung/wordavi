# docs-site

This directory holds the [Quartz v4](https://github.com/jackyzha0/quartz) configuration used to
publish the vault in `docs/` as a static documentation site.

Quartz itself is not vendored here — only `quartz.config.ts` and `quartz.layout.ts` live in this
repo. The site is built in CI by `Dockerfile.docs`, which clones Quartz pinned to the
`QUARTZ_REF` build argument (currently `v4.5.2`), runs `npm ci`, copies these two config files and
the `docs/` vault (as `content/`) into the clone, and runs `npx quartz build`.

## Preview locally

```bash
QUARTZ_REF=v4.5.2   # keep in sync with Dockerfile.docs
git clone --depth 1 --branch "$QUARTZ_REF" https://github.com/jackyzha0/quartz.git /tmp/quartz
cd /tmp/quartz
npm ci
cp /path/to/repo/docs-site/quartz.config.ts /path/to/repo/docs-site/quartz.layout.ts ./
rm -rf content && cp -r /path/to/repo/docs content
npx quartz build --serve
```

Then open the printed local URL. When bumping Quartz, update `QUARTZ_REF` in `Dockerfile.docs` and
the value above together.
