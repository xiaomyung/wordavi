/**
 * Losing the network is a UI event, not an outage: the written modes keep
 * working and the voice ones say why they are paused.
 *
 * The page is loaded first and only then taken offline — the service worker is
 * blocked for this project, so a cold navigation offline would fail for reasons
 * that have nothing to do with the home screen. (Real offline launches belong to
 * pwa.spec.ts.)
 */
import { expect, test } from '@playwright/test';
import { drillCounter, expectHome, gotoApp, seedApp, startMode } from './helpers';

test.beforeEach(async ({ page, context }) => {
  await seedApp(page);
  await gotoApp(page);
  await expectHome(page);
  await context.setOffline(true);
});

test.afterEach(async ({ context }) => {
  await context.setOffline(false);
});

test('the voice modes pause with an explanation while the written ones stay live', async ({
  page,
}) => {
  // The header owns the offline badge.
  await expect(page.locator('header').getByText('офлайн')).toBeVisible();

  const listen = page.getByRole('button', { name: /На слух/ });
  await expect(listen).toHaveAttribute('aria-disabled', 'true');
  await expect(listen).toContainText('вернётся с интернетом');
  await expect(page.getByRole('button', { name: /Скажите вслух/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  // Prices are typed, not spoken: the row keeps working without a network, and
  // only loses the optional replay of the price.
  await expect(page.getByRole('button', { name: /Цены и веса/ })).not.toHaveAttribute(
    'aria-disabled',
    'true',
  );

  // Tapping a paused row explains rather than starting a round it cannot run.
  // `force` because the row advertises itself as aria-disabled — it is still a
  // live button by design, and tapping it is exactly what a learner would do.
  await listen.click({ force: true });
  await expect(page.getByRole('status')).toContainText('Нет интернета');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Добр');
});

test('a written mode still starts a full round offline', async ({ page }) => {
  await startMode(page, /Число → словами/);

  await expect(drillCounter(page)).toHaveText('1 из 10');
  await expect(page.getByTestId('numeral-prompt')).toBeVisible();
});

test('coming back online un-pauses the network modes in place', async ({ page, context }) => {
  // The microphone mode needs the network but no voice pack, so it is the one
  // row whose pause is purely about connectivity in a headless browser.
  const speak = page.getByRole('button', { name: /Скажите вслух/ });
  await expect(speak).toHaveAttribute('aria-disabled', 'true');

  await context.setOffline(false);

  await expect(page.locator('header').getByText('офлайн')).toHaveCount(0);
  await expect(speak).not.toHaveAttribute('aria-disabled', 'true');
});
