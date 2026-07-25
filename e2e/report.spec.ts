/**
 * "Сообщить о проблеме": the sheet opens over settings, keeps what was typed,
 * and the copy path puts the diagnostics on the clipboard with a toast to say
 * so. Sending is not exercised — it hands off to the OS share sheet or a mail
 * client, neither of which exists in a test browser. What is exercised is the
 * warning that precedes the hand-off, because the learner has to read it before
 * their mail app takes over.
 */
import { Buffer } from 'node:buffer';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { expectHome, gotoApp, seedApp } from './helpers';

/** 1x1 PNG: the thumbnail has to decode, its pixels don't matter. */
const PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC';

const ATTACH_WARNING =
  'Скриншот нельзя отправить вместе с письмом — прикрепите его в почте сами. Файл: ekran.png';

/**
 * A browser with a share sheet that either takes files or only takes text —
 * the second is what desktop Chrome and several mobile browsers are. Sharing
 * files is a platform capability rather than a UA string, so without this a
 * headless run would assert whatever the host OS happens to support.
 */
async function setFileSharing(page: Page, supported: boolean): Promise<void> {
  await page.evaluate((filesAllowed) => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: () => Promise.resolve(),
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => filesAllowed,
    });
  }, supported);
}

async function attachScreenshot(page: Page): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles({
    name: 'ekran.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PIXEL_PNG, 'base64'),
  });
}

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

test('says the screenshot needs attaching by hand before the mail app opens', async ({ page }) => {
  await setFileSharing(page, false);
  await attachScreenshot(page);

  await expect(page.getByAltText('ekran.png')).toBeVisible();
  await expect(page.getByText(ATTACH_WARNING)).toBeVisible();

  // Removing the screenshot removes the problem it warned about.
  await page.getByRole('button', { name: 'Закрыть · ekran.png' }).click();
  await expect(page.getByText(ATTACH_WARNING)).toBeHidden();
});

test('keeps quiet about attaching when the browser can share the file', async ({ page }) => {
  await setFileSharing(page, true);
  await attachScreenshot(page);

  await expect(page.getByAltText('ekran.png')).toBeVisible();
  await expect(page.getByText(ATTACH_WARNING)).toBeHidden();
});

test('closing the report returns to settings', async ({ page }) => {
  await page.getByRole('button', { name: 'Закрыть' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Настройки');
});
