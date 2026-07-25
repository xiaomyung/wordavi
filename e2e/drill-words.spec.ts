/**
 * The correct-answer path, end to end: number → es-ES words, graded by the real
 * engine. The spec computes the expected spelling with the same pure function
 * the app grades against (see helpers.ts), so nothing here is hard-coded to a
 * seed and the round can still be replayed byte-for-byte via `?seed=`.
 */
import { expect, test } from '@playwright/test';
import {
  advance,
  answerField,
  answerWords,
  drillCounter,
  E2E_ROUND_SIZE,
  expectHome,
  expectSummary,
  gotoApp,
  playWordsRound,
  promptNumber,
  seedApp,
  startMode,
  WORDS_MODE,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await seedApp(page);
  await gotoApp(page, { seed: '4242' });
  await expectHome(page);
});

test('a word answer is typed, graded and scored', async ({ page }) => {
  await startMode(page, WORDS_MODE);
  await expect(drillCounter(page)).toHaveText(`1 из ${E2E_ROUND_SIZE}`);

  // The accent row types into the field at the caret (it never steals focus).
  await answerField(page).fill('cuar');
  await page.getByRole('button', { name: 'á' }).click();
  await expect(answerField(page)).toHaveValue(/á/);

  await answerWords(page, true);

  await expect(page.getByText('¡Muy bien!')).toBeVisible();
  await expect(page.getByText('+10 очков · 1-е подряд')).toBeVisible();
  // The field freezes and wears its verdict stamp instead of being cleared.
  await expect(page.locator('textarea[data-verdict="correct"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Проверить' })).toHaveCount(0);

  // Score chip ticked, combo chip still below its threshold of two.
  await expect(page.locator('header').getByText(/^10\s*очков$/)).toBeVisible();
  await expect(page.getByText('×2')).toHaveCount(0);

  await advance(page);
  await expect(drillCounter(page)).toHaveText(`2 из ${E2E_ROUND_SIZE}`);
  await answerWords(page, true);
  await expect(page.getByText('×2')).toBeVisible();
});

test('a clean round ends on a summary with no retry offered', async ({ page }) => {
  await startMode(page, WORDS_MODE);
  await playWordsRound(page, E2E_ROUND_SIZE, true);

  await expectSummary(page);
  await expect(page.getByText('Число → словами · 10 вопросов')).toBeVisible();
  // Accuracy ring, the fraction beside it, and the score line.
  await expect(page.getByRole('img', { name: '100%' })).toBeVisible();
  await expect(page.getByText('10 из 10')).toBeVisible();
  await expect(page.getByText('+100 очков · лучшая серия ×10')).toBeVisible();
  await expect(page.getByText('¡Muy bien!')).toBeVisible();

  // Nothing was missed, so the retry CTA is not on the screen at all.
  await expect(page.getByRole('button', { name: /Повторить ошибки/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'На главный' }).click();
  await expectHome(page);
  // The round is folded into the day: 10 of the 20-answer goal are done.
  await expect(page.getByText('10 из 20')).toBeVisible();
});

test('the same seed replays the same first question', async ({ page }) => {
  await startMode(page, WORDS_MODE);
  const first = await promptNumber(page);

  await page.reload();
  await expectHome(page);
  await startMode(page, WORDS_MODE);

  expect(await promptNumber(page)).toBe(first);
});
