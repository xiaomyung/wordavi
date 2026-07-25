/**
 * Visual regression baselines — the mobile project only, so there is exactly
 * one source of truth per screen (a desktop copy would double the maintenance
 * for a layout the design does not target).
 *
 * Determinism, in order of importance:
 *   - the clock is frozen, because the home greeting, the date line and the
 *     streak window all read it;
 *   - drills run under `?seed=`, so the numeral on stage is always the same;
 *   - `prefers-reduced-motion: reduce` neutralises the app's transitions on top
 *     of Playwright's own animation freezing;
 *   - the seeded day rows are generated from the frozen date, not the host's.
 *
 * Regenerate after an intentional design change:
 *   pnpm exec playwright test e2e/visual.spec.ts --project=mobile --update-snapshots
 *
 * The baselines are committed as rendered by the machine that generated them.
 * Glyph rasterisation differs between freetype builds, so a runner that did not
 * produce the PNGs will report diffs that mean nothing about the design — these
 * tests therefore stay out of CI unless `VISUAL=1` says the baselines belong to
 * that machine. Everything else in the suite runs everywhere.
 */
import { expect, test } from '@playwright/test';
import {
  daysSeed,
  E2E_ROUND_SIZE,
  expectHome,
  expectSummary,
  gotoApp,
  playWordsRound,
  seedApp,
  srsSeed,
  startMode,
  WORDS_MODE,
} from './helpers';

/** A Tuesday morning: "Доброе утро!" plus a stable date line. */
const FROZEN = new Date('2026-03-24T08:30:00.000Z');

test.use({ timezoneId: 'Europe/Madrid', locale: 'ru-RU' });

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'baselines are kept for the mobile project only');
  test.skip(
    Boolean(process.env.CI) && process.env.VISUAL !== '1',
    'baselines were rasterised elsewhere; set VISUAL=1 on a runner that owns them',
  );
  await page.clock.setFixedTime(FROZEN);
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

/** A dashboard with something on it: three stamped days and a live streak. */
const DASHBOARD = {
  days: daysSeed(3, { base: FROZEN }),
  srs: srsSeed(),
  progress: { streakCurrent: 3, streakBest: 5, totalAnswered: 75, totalCorrect: 61 },
};

for (const theme of ['light', 'dark'] as const) {
  test(`home · ${theme}`, async ({ page }) => {
    await seedApp(page, { ...DASHBOARD, settings: { theme } });
    await gotoApp(page);
    await expectHome(page);
    await expect(page).toHaveScreenshot(`home-${theme}.png`);
  });

  test(`drill words · ${theme}`, async ({ page }) => {
    await seedApp(page, { settings: { theme } });
    await gotoApp(page, { seed: '31' });
    await startMode(page, WORDS_MODE);
    await expect(page.getByTestId('numeral-prompt')).toBeVisible();
    await expect(page).toHaveScreenshot(`drill-words-${theme}.png`);
  });

  test(`gallery buttons · ${theme}`, async ({ page }) => {
    await seedApp(page, { settings: { theme } });
    await gotoApp(page, { gallery: '1' });
    // A section-scoped shot rather than the whole page: it keeps the looping
    // mic rings (and every other live specimen) out of the frame entirely,
    // which is steadier than masking them.
    await expect(page.locator('#buttons')).toHaveScreenshot(`gallery-buttons-${theme}.png`);
  });
}

test('summary · light', async ({ page }) => {
  await seedApp(page);
  await gotoApp(page, { seed: '31' });
  await startMode(page, WORDS_MODE);
  await playWordsRound(page, E2E_ROUND_SIZE, true);
  await expectSummary(page);
  await expect(page).toHaveScreenshot('summary-light.png');
});

test('settings · dark', async ({ page }) => {
  await seedApp(page, { settings: { theme: 'dark' } });
  await gotoApp(page);
  await page.getByRole('button', { name: 'Настройки' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Настройки');
  await expect(page).toHaveScreenshot('settings-dark.png');
});

test('stats · light', async ({ page }) => {
  await seedApp(page, {
    days: daysSeed(5, { base: FROZEN }),
    srs: srsSeed(),
    progress: {
      streakCurrent: 5,
      streakBest: 7,
      totalAnswered: 154,
      totalCorrect: 113,
    },
  });
  await gotoApp(page);
  await page.getByRole('button', { name: 'Статистика' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Статистика');
  await expect(page).toHaveScreenshot('stats-light.png');
});

test('onboarding step one · light', async ({ page }) => {
  await seedApp(page, { onboarded: false });
  await gotoApp(page);
  // Step one is the install step (manual affordance renders under Playwright).
  await expect(page.getByRole('button', { name: 'Продолжить в браузере' })).toBeVisible();
  await expect(page).toHaveScreenshot('onboarding-step1-light.png');
});

test('gallery price tags · light', async ({ page }) => {
  await seedApp(page);
  await gotoApp(page, { gallery: '1' });
  await expect(page.locator('#price')).toHaveScreenshot('gallery-price-light.png');
});
