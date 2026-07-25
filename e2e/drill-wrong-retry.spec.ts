/**
 * The corrective path: every answer wrong, then "Повторить ошибки" replaying
 * exactly those questions. A wrong answer is corrected, never punished — the
 * spec asserts the reveal and the encouraging tail, not a penalty.
 */
import { expect, test } from '@playwright/test';
import { numberToWords } from '../src/engine';
import {
  advance,
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
  WRONG_WORD,
} from './helpers';

test('a missed round reveals its answers and replays them on demand', async ({ page }) => {
  await seedApp(page);
  await gotoApp(page, { seed: '7' });
  await expectHome(page);
  await startMode(page, WORDS_MODE);

  // First question: the reveal names the right answer and nothing scolds.
  const firstValue = await promptNumber(page);
  await answerWords(page, false);
  await expect(page.getByText(`Правильно: ${numberToWords(firstValue)}`)).toBeVisible();
  await expect(page.getByText('бывает, ещё встретится')).toBeVisible();
  await expect(page.locator('textarea[data-verdict="wrong"]')).toBeVisible();
  await advance(page);

  for (let step = 2; step <= E2E_ROUND_SIZE; step += 1) {
    await expect(drillCounter(page)).toHaveText(`${step} из ${E2E_ROUND_SIZE}`);
    await answerWords(page, false);
    await advance(page);
  }

  await expectSummary(page);
  await expect(page.getByRole('img', { name: '0%' })).toBeVisible();
  await expect(page.getByText('0 из 10')).toBeVisible();
  // Misses are listed with what was typed struck through and the correction under it.
  await expect(page.getByText(WRONG_WORD).first()).toBeVisible();
  await expect(page.getByText(numberToWords(firstValue)).first()).toBeVisible();

  const retry = page.getByRole('button', { name: `Повторить ошибки (${E2E_ROUND_SIZE})` });
  await expect(retry).toBeVisible();
  await retry.click();

  // The retry round is exactly the missed questions — and it can be cleared.
  await expect(drillCounter(page)).toHaveText(`1 из ${E2E_ROUND_SIZE}`);
  await playWordsRound(page, E2E_ROUND_SIZE, true);

  await expectSummary(page);
  await expect(page.getByText('10 из 10')).toBeVisible();
  await expect(page.getByRole('button', { name: /Повторить ошибки/ })).toHaveCount(0);
});
