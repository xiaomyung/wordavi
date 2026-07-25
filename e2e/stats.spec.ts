/**
 * Stats: a day-zero screen that invites the first round, and a populated one
 * that reads its totals, month accuracy and skill bars out of storage.
 */
import { expect, test } from '@playwright/test';
import { dayKey, daysSeed, drillCounter, expectHome, gotoApp, seedApp, srsSeed } from './helpers';

async function openStats(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Статистика' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Статистика');
}

test('day zero invites the first round instead of showing empty charts', async ({ page }) => {
  await seedApp(page);
  await gotoApp(page);
  await expectHome(page);
  await openStats(page);

  await expect(page.getByRole('heading', { name: 'Пока пусто' })).toBeVisible();
  await expect(page.getByText('первый штамп — за первый раунд сегодня')).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);

  await page.getByRole('button', { name: 'Начать первый раунд' }).click();
  await expect(drillCounter(page)).toHaveText('1 из 10');
});

test('a practised history renders totals, month accuracy and skill bars', async ({ page }) => {
  const days = daysSeed(4, { answered: 25, correct: 20 });
  await seedApp(page, {
    days,
    srs: srsSeed(),
    progress: {
      streakCurrent: 4,
      streakBest: 6,
      lastGoalDate: dayKey(0),
      bestCombo: 9,
      totalAnswered: 154,
      totalCorrect: 113,
    },
  });
  await gotoApp(page);
  await openStats(page);

  await expect(page.getByText('рекорд — 6 дней')).toBeVisible();
  // 154 lifetime answers — three digits, so no group separator to print yet.
  await expect(page.getByText(/^154$/)).toBeVisible();
  await expect(page.getByText('ответов всего')).toBeVisible();
  await expect(page.getByText('точность за месяц')).toBeVisible();

  // One bar per display group, plus the flag on the group seeded below 60%.
  await expect(page.getByRole('progressbar')).toHaveCount(6);
  await expect(page.getByRole('progressbar', { name: 'единицы · 1–9' })).toHaveAttribute(
    'aria-valuenow',
    '88',
  );
  await expect(page.getByRole('progressbar', { name: 'тысячи' })).toHaveAttribute(
    'aria-valuenow',
    '29',
  );
  await expect(page.getByText('потренировать').first()).toBeVisible();

  await page.getByRole('button', { name: 'Назад' }).click();
  await expectHome(page);
  // The seeded streak reaches the dashboard too.
  await expect(page.getByText('4 дня')).toBeVisible();
});
