/**
 * The onboarding gate — the only flow that runs against genuinely empty
 * storage, which is why nothing here calls `seedApp`.
 */
import { expect, test } from '@playwright/test';
import {
  advance,
  answerAnything,
  drillCounter,
  expectHome,
  gotoApp,
  modeOverline,
} from './helpers';

/**
 * Install → language → practice → app → ready. Stops before the two exits.
 *
 * Chromium under test fires no `beforeinstallprompt` and this is not iOS, so the
 * install step opens in its 'manual' state — the same five-step flow Brave and
 * Firefox users get. The prompt/iOS/standalone branches of the matrix are
 * covered in tests/screens/onboarding.test.tsx, where the affordance can be
 * driven directly.
 */
async function skipInstallStep(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Установите на телефон');
  await page.getByRole('button', { name: 'Продолжить в браузере' }).click();
}

async function walkToLastStep(page: import('@playwright/test').Page): Promise<void> {
  await gotoApp(page);
  await skipInstallStep(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Привет!');

  await page.getByRole('button', { name: 'Русский' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('С чего начнём?');

  await page.getByRole('button', { name: 'Дальше' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Как удобнее?');

  await page.getByRole('button', { name: 'Дальше' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Пять минут в день');
}

test('a first visit walks every step and lands in the first round', async ({ page }) => {
  await walkToLastStep(page);

  // The mic ask sits on the last step and is skippable by simply not tapping it:
  // nothing is granted here, and the round still starts.
  await expect(page.getByText('Микрофон — для режима «Скажите вслух»')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Разрешить микрофон' })).toBeVisible();

  await page.getByRole('button', { name: 'Начать первый раунд' }).click();

  // The drill is live: shared header, and a first question that names the mode
  // it came from — the first round is the mixed one.
  await expect(drillCounter(page)).toHaveText('1 из 20');
  await expect(modeOverline(page)).not.toBeEmpty();
});

test('the install step offers the browser-menu recipe before anything else', async ({ page }) => {
  await gotoApp(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Установите на телефон');

  await page.getByRole('button', { name: 'Установить приложение' }).click();
  await expect(page.getByText('Установить через меню браузера')).toBeVisible();

  // Never a gate: the ghost carries on into the rest of onboarding.
  await page.getByRole('button', { name: 'Продолжить в браузере' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Привет!');
});

test('the ghost exit ends onboarding on home, with the gate closed for good', async ({ page }) => {
  await walkToLastStep(page);

  await page.getByRole('button', { name: 'Сначала посмотреть режимы' }).click();
  await expectHome(page);

  // Onboarding was seen either way — a reload must not ask again.
  await page.reload();
  await expectHome(page);
});

test('a step can be walked back without losing the language choice', async ({ page }) => {
  await gotoApp(page);
  await skipInstallStep(page);
  await page.getByRole('button', { name: 'Русский' }).click();
  await page.getByRole('button', { name: 'Дальше' }).click();

  await page.getByRole('button', { name: 'Назад' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('С чего начнём?');

  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Сначала посмотреть режимы' }).click();
  await expectHome(page);
});

test('onboarding settings are the real ones and stick', async ({ page }) => {
  await gotoApp(page);
  await skipInstallStep(page);
  await page.getByRole('button', { name: 'Русский' }).click();

  // Step 2 renders the live settings controls: the round stepper writes through.
  const rounds = page.getByRole('group', { name: 'Вопросов в раунде' });
  await rounds.getByRole('button', { name: 'Increase' }).click();
  await expect(rounds.getByText('30')).toBeVisible();

  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Начать первый раунд' }).click();

  await expect(drillCounter(page)).toHaveText('1 из 30');
  // …and the drill is answerable straight away, whichever mode it opened with.
  await answerAnything(page);
  await advance(page);
  await expect(drillCounter(page)).toHaveText('2 из 30');
});
