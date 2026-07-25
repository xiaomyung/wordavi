import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * The one spec that wants a service worker. Everything else blocks them (see
 * playwright.config.ts) so a precache can never answer another spec's
 * navigation. Requires a fresh `pnpm build`, since preview serves dist as-is.
 */
test.use({ serviceWorkers: 'allow' });

/** Resolves once the worker is active, which means precaching has finished. */
async function serviceWorkerScope(page: Page): Promise<string> {
  return page.evaluate(() => navigator.serviceWorker.ready.then((reg) => reg.scope));
}

test('the app registers a service worker and links an installable manifest', async ({ page }) => {
  await page.goto('/');

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();

  const response = await page.request.get(new URL(href as string, page.url()).toString());
  expect(response.ok()).toBe(true);

  const manifest = (await response.json()) as {
    name: string;
    short_name: string;
    display: string;
    orientation: string;
    start_url: string;
    icons: { src: string; purpose?: string }[];
  };
  expect(manifest.name).toBe('wordavi — испанские числа');
  expect(manifest.short_name).toBe('wordavi');
  expect(manifest.display).toBe('standalone');
  expect(manifest.orientation).toBe('portrait');
  expect(manifest.icons.filter((icon) => icon.purpose === 'maskable')).toHaveLength(2);

  expect(await serviceWorkerScope(page)).toBe(`${new URL('/', page.url()).toString()}`);
});

test('a precached install still opens with the network down', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await serviceWorkerScope(page);

  await context.setOffline(true);
  try {
    await page.reload();
    // Reaching a rendered heading offline means the document, its JS/CSS and
    // the fonts all came from the precache.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
