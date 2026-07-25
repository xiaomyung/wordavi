/**
 * Settings: every control writes through immediately, takes effect live, and is
 * still there after a reload. No save button exists — that is the contract.
 */
import { expect, test } from '@playwright/test';
import { drillCounter, expectHome, gotoApp, seedApp, startMode, WORDS_MODE } from './helpers';

async function openSettings(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Настройки' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Настройки');
}

test.beforeEach(async ({ page }) => {
  await seedApp(page);
  await gotoApp(page);
  await expectHome(page);
});

test('the theme choice paints the app and survives a reload', async ({ page }) => {
  await openSettings(page);
  await expect(page.locator('html')).not.toHaveClass(/dark/);

  await page.getByRole('radio', { name: 'Тёмная' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('the interface language switches the whole app at once', async ({ page }) => {
  await openSettings(page);

  await page.getByRole('radio', { name: 'English' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
  await expect(page.getByText('Questions per round')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Good');
  await expect(page.getByText('Daily goal')).toBeVisible();
});

test('the range slider takes keyboard input and keeps it', async ({ page }) => {
  await openSettings(page);
  const top = page.getByRole('slider', { name: 'Диапазон чисел — max' });

  await expect(top).toHaveAttribute('aria-valuenow', '100');
  await top.focus();
  await page.keyboard.press('ArrowRight');
  const raised = await top.getAttribute('aria-valuenow');
  expect(Number(raised)).toBeGreaterThan(100);

  await page.reload();
  await openSettings(page);
  await expect(page.getByRole('slider', { name: 'Диапазон чисел — max' })).toHaveAttribute(
    'aria-valuenow',
    raised ?? '',
  );
});

test('the round stepper reaches the endless round, and the drill counts to ∞', async ({ page }) => {
  await openSettings(page);
  const rounds = page.getByRole('group', { name: 'Вопросов в раунде' });

  // 10 → 20 → 30 → ∞: both keys always step, and the last stop is endless.
  for (const expected of ['20', '30', '∞']) {
    await rounds.getByRole('button', { name: 'Increase' }).click();
    await expect(rounds.getByText(expected, { exact: true })).toBeVisible();
  }

  await page.getByRole('button', { name: 'Назад' }).click();
  await expectHome(page);
  await startMode(page, WORDS_MODE);

  await expect(drillCounter(page)).toHaveText('1 · ∞');
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Завершить раунд' })).toBeVisible();
});
