/**
 * The parked round: a drill that is left mid-way survives a reload and comes
 * back where it was, rather than restarting or vanishing.
 */
import { expect, test } from '@playwright/test';
import {
  advance,
  answerWords,
  drillCounter,
  E2E_ROUND_SIZE,
  expectHome,
  gotoApp,
  promptNumber,
  seedApp,
  startMode,
} from './helpers';

const WORDS_MODE = /Число → словами/;

test('a reload offers to continue the parked round at the same question', async ({ page }) => {
  await seedApp(page);
  await gotoApp(page, { seed: '512' });
  await expectHome(page);
  // A fresh install has nothing to continue.
  await expect(page.getByRole('button', { name: 'Начать первый раунд' })).toBeVisible();

  await startMode(page, WORDS_MODE);
  for (let step = 1; step <= 3; step += 1) {
    await expect(drillCounter(page)).toHaveText(`${step} из ${E2E_ROUND_SIZE}`);
    await answerWords(page, true);
    if (step < 3) await advance(page);
  }
  const parked = await promptNumber(page);

  await page.reload();

  await expectHome(page);
  const resume = page.getByRole('button', {
    name: `Продолжить · 3 из ${E2E_ROUND_SIZE}`,
  });
  await expect(resume).toBeVisible();

  await resume.click();

  // Same question, same counter, same score — not a fresh round.
  await expect(drillCounter(page)).toHaveText(`3 из ${E2E_ROUND_SIZE}`);
  expect(await promptNumber(page)).toBe(parked);
  await expect(page.locator('header').getByText(/^30\s*очков$/)).toBeVisible();

  await advance(page);
  await expect(drillCounter(page)).toHaveText(`4 из ${E2E_ROUND_SIZE}`);
});

test('leaving a round from the drill keeps it resumable', async ({ page }) => {
  await seedApp(page);
  await gotoApp(page, { seed: '513' });
  await startMode(page, WORDS_MODE);

  await answerWords(page, true);
  await advance(page);
  await page.getByRole('button', { name: 'Закрыть' }).click();

  await expectHome(page);
  await expect(
    page.getByRole('button', { name: `Продолжить · 1 из ${E2E_ROUND_SIZE}` }),
  ).toBeVisible();
});
