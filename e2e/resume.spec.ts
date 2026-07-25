/**
 * The parked round: a drill that is left mid-way survives a reload and comes
 * back where it was, rather than restarting or vanishing.
 *
 * A single-mode round comes back on *its own row*: the big button is always the
 * mixed round, so it never quietly turns into one mode's continuation.
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
  startRound,
  WORDS_MODE,
} from './helpers';

/** The big button's two labels — never a "continue" for a single-mode round. */
const START_CTA = /^Начать (первый )?раунд$/;

test('a reload offers the parked round on its own mode row', async ({ page }) => {
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
  // The big button stays the mixed round, and the words row carries the hint.
  await expect(page.getByRole('button', { name: START_CTA })).toBeVisible();
  await expect(page.getByRole('button', { name: /Продолжить/ })).toHaveCount(0);

  const row = page.getByRole('button', { name: WORDS_MODE });
  await expect(row.getByText(`продолжить · 3 из ${E2E_ROUND_SIZE}`)).toBeVisible();

  await row.click();

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
    page.getByRole('button', { name: WORDS_MODE }).getByText(`продолжить · 1 из ${E2E_ROUND_SIZE}`),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: START_CTA })).toBeVisible();
});

test('the big button starts a fresh mixed round while a single-mode one is parked', async ({
  page,
}) => {
  await seedApp(page);
  await gotoApp(page, { seed: '514' });
  await startMode(page, WORDS_MODE);

  await answerWords(page, true);
  await advance(page);
  await expect(drillCounter(page)).toHaveText(`2 из ${E2E_ROUND_SIZE}`);
  await page.getByRole('button', { name: 'Закрыть' }).click();
  await expectHome(page);

  await startRound(page);

  // Question one of a brand new round, not question two of the parked one.
  await expect(drillCounter(page)).toHaveText(`1 из ${E2E_ROUND_SIZE}`);
});
