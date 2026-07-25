/**
 * "Сообщить о проблеме": the sheet opens over settings, keeps what was typed,
 * and the copy path puts the diagnostics on the clipboard with a toast to say
 * so. Sending is not exercised — it hands off to the OS share sheet or a mail
 * client, neither of which exists in a test browser.
 */
import { expect, test } from '@playwright/test';
import { expectHome, gotoApp, seedApp } from './helpers';

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await seedApp(page);
  await gotoApp(page);
  await expectHome(page);
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: 'Сообщить о проблеме' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Сообщить о проблеме');
});

test('a written report is copied to the clipboard with the diagnostics attached', async ({
  page,
}) => {
  // The diagnostics line says what travels along, and is not editable.
  await expect(page.getByText(/^v\d+\.\d+\.\d+ · errors \d+ · log \d+$/)).toBeVisible();

  const note = page.getByRole('textbox', { name: 'Сообщить о проблеме' });
  await note.fill('кнопка «Проверить» не нажимается');

  await page.getByRole('button', { name: 'Скопировать' }).click();

  await expect(page.getByRole('status')).toContainText('Скопировано');
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain('кнопка «Проверить» не нажимается');
  expect(clipboard).toContain('wordavi');
});

test('closing the report returns to settings', async ({ page }) => {
  await page.getByRole('button', { name: 'Закрыть' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Настройки');
});
