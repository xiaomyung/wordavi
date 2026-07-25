/**
 * The big button on home plays a MIXED round: every question comes from another
 * of the available modes, and the drill says which one above the prompt.
 *
 * Answers go down the wrong path throughout — it is the one path every mode
 * shares, and what is under test is the mixing, not the grading.
 */
import { expect, test } from '@playwright/test';
import {
  advance,
  answerAnything,
  drillCounter,
  E2E_ROUND_SIZE,
  expectHome,
  expectSummary,
  gotoApp,
  modeOverline,
  seedApp,
  startRound,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await seedApp(page);
  await gotoApp(page, { seed: '9091' });
  await expectHome(page);
});

test('the start button plays a round drawn from several modes', async ({ page }) => {
  await startRound(page);

  const titles: string[] = [];
  for (let step = 1; step <= E2E_ROUND_SIZE; step += 1) {
    await expect(drillCounter(page)).toHaveText(`${step} из ${E2E_ROUND_SIZE}`);
    titles.push(((await modeOverline(page).textContent()) ?? '').trim());
    await answerAnything(page);
    await advance(page);
  }

  // The overline named a mode for every question, and not the same one twice
  // in a row for more than a pair (a due wrongQueue item replays its own mode).
  expect(new Set(titles).size).toBeGreaterThan(1);
  for (let i = 2; i < titles.length; i += 1) {
    expect([titles[i - 2], titles[i - 1], titles[i]]).not.toEqual([
      titles[i],
      titles[i],
      titles[i],
    ]);
  }

  await expectSummary(page);
  await expect(page.getByText(`Смешанный раунд · ${E2E_ROUND_SIZE} вопросов`)).toBeVisible();
});

test('a mixed round parks and resumes like any other', async ({ page }) => {
  await startRound(page);
  await answerAnything(page);
  await advance(page);

  // The second question is the one the round parks on.
  await expect(drillCounter(page)).toHaveText(`2 из ${E2E_ROUND_SIZE}`);
  const overline = ((await modeOverline(page).textContent()) ?? '').trim();
  await answerAnything(page);

  await page.reload();
  await expectHome(page);

  const resume = page.getByRole('button', { name: `Продолжить · 2 из ${E2E_ROUND_SIZE}` });
  await expect(resume).toBeVisible();
  await resume.click();

  // Same counter, same question, still that question's own mode — not a fresh
  // round and not the composite's title.
  await expect(drillCounter(page)).toHaveText(`2 из ${E2E_ROUND_SIZE}`);
  await expect(modeOverline(page)).toHaveText(overline);
  await expect(page.getByRole('button', { name: 'Дальше' })).toBeVisible();
});

test('a mode row still plays only that mode', async ({ page }) => {
  await page.getByRole('button', { name: /Число → словами/ }).click();

  for (let step = 1; step <= 3; step += 1) {
    await expect(drillCounter(page)).toHaveText(`${step} из ${E2E_ROUND_SIZE}`);
    await expect(modeOverline(page)).toHaveText('Число → словами');
    await answerAnything(page);
    await advance(page);
  }
});
