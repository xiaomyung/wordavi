/**
 * Where the component gallery's build-time switch is pinned.
 *
 * The config is loaded the way vite loads it, once per kind of build, so what is
 * asserted is the constant a real build would stamp into the bundle rather than a
 * second copy of the rule. This is the guarantee the app leans on: by the time a
 * browser can ask for the gallery, the answer is already compiled in, so a
 * shipped build has nothing left to be talked into.
 */
import { resolve } from 'node:path';
import type { ConfigEnv } from 'vite';
import { loadConfigFromFile } from 'vite';
import { beforeEach, describe, expect, it } from 'vitest';

const CONFIG = resolve(__dirname, '../vite.config.ts');
const GALLERY_ENV = 'WORDAVI_GALLERY';

/** What `__GALLERY__` folds to for one invocation of the build. */
async function galleryConstant(env: Partial<ConfigEnv> = {}): Promise<unknown> {
  const loaded = await loadConfigFromFile(
    { command: 'build', mode: 'production', ...env },
    CONFIG,
    undefined,
    'silent',
  );
  return loaded?.config.define?.__GALLERY__;
}

// Each case states its own flag; a shell that happens to export one is not
// allowed to decide what "a production build" means here.
beforeEach(() => {
  delete process.env[GALLERY_ENV];
});

describe('the gallery build flag', () => {
  it('leaves the gallery out of a production build', async () => {
    await expect(galleryConstant()).resolves.toBe('false');
  });

  it('puts the gallery in when the build is asked to, and only then', async () => {
    process.env[GALLERY_ENV] = '1';
    await expect(galleryConstant()).resolves.toBe('true');

    for (const value of ['', '0', 'false', 'yes']) {
      process.env[GALLERY_ENV] = value;
      await expect(galleryConstant()).resolves.toBe('false');
    }
  });

  it('always has the gallery while serving — dev and the unit runs', async () => {
    await expect(galleryConstant({ command: 'serve', mode: 'development' })).resolves.toBe('true');
    await expect(galleryConstant({ command: 'serve', mode: 'test' })).resolves.toBe('true');
  });
});
