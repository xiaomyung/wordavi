/**
 * The readme's screenshots, regenerated on demand:
 *
 *   SHOTS=1 pnpm exec playwright test e2e/screenshots.spec.ts --project=mobile
 *
 * Skipped otherwise, because it writes into docs/assets/screenshots/ and an
 * ordinary suite run should leave the working tree alone. The state is seeded
 * rather than played into existence so the images are reproducible: a frozen
 * clock (the greeting and the date line read from it), fixed `?seed=` values,
 * reduced motion, and an English interface, since the readme is in English.
 */
import { expect, test } from '@playwright/test';
import { numberToWords } from '../src/engine';
import { dayKey, daysSeed, gotoApp, promptNumber, seedApp, srsSeed } from './helpers';

const OUT = 'docs/assets/screenshots';
/** A Tuesday morning, so the greeting and the date line never drift. */
const FROZEN = new Date('2026-03-24T08:30:00.000Z');
const EN = { uiLang: 'en', theme: 'light' } as const;

test.use({ timezoneId: 'Europe/Madrid', locale: 'en-GB' });

test.beforeEach(async ({ page }) => {
  test.skip(!process.env.SHOTS, 'set SHOTS=1 to regenerate the readme screenshots');
  await page.clock.setFixedTime(FROZEN);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Headless Chromium ships no voices, which would leave the listening row
  // paused in a screenshot meant to show the app on an ordinary phone.
  await page.addInitScript(() => {
    const voice = {
      name: 'Spanish',
      lang: 'es-ES',
      localService: true,
      default: true,
      voiceURI: 'es',
    };
    Object.defineProperty(window.speechSynthesis, 'getVoices', { value: () => [voice] });
  });
});

test('home', async ({ page }) => {
  await seedApp(page, {
    settings: { ...EN },
    // three stamped days behind, today still in progress at 12 of 20
    days: [
      ...daysSeed(3, { base: new Date(FROZEN.getTime() - 86_400_000) }),
      {
        date: dayKey(0, FROZEN),
        answered: 15,
        correct: 12,
        byGroup: { small: { answered: 15, correct: 12 } },
      },
    ],
    srs: srsSeed(),
    progress: {
      streakCurrent: 6,
      streakBest: 7,
      // yesterday, so the streak is alive rather than settled to zero
      lastGoalDate: dayKey(1, FROZEN),
      totalAnswered: 120,
      totalCorrect: 96,
    },
  });
  await gotoApp(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Good morning');
  await page.screenshot({ path: `${OUT}/home-dashboard.png` });
});

test('drill', async ({ page }) => {
  await seedApp(page, { settings: { ...EN, rangeMin: 100, rangeMax: 1000 } });
  await gotoApp(page, { seed: '11' });
  await page.getByRole('button', { name: /Number → in words/ }).click();
  // Two answered correctly first, so the score and the combo chip are alive —
  // a fresh round would photograph as an empty header.
  for (let step = 0; step < 2; step += 1) {
    const value = await promptNumber(page);
    await page.getByRole('textbox').fill(numberToWords(value));
    await page.getByRole('button', { name: 'Check' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
  }
  const shown = await promptNumber(page);
  await page.getByRole('textbox').fill(numberToWords(shown));
  console.log(`DRILL third numeral = ${shown}`);
  await page.screenshot({ path: `${OUT}/drill-number-to-words.png` });
});

test('grocery', async ({ page }) => {
  await seedApp(page, { settings: { ...EN } });
  await gotoApp(page, { seed: '31' });
  await page.getByRole('button', { name: /Prices & weights/ }).click();
  await expect(page.getByText('How would the cashier say it?')).toBeVisible();
  await page.screenshot({ path: `${OUT}/grocery-price-tag.png` });
});

test('summary', async ({ page }) => {
  await seedApp(page, {
    settings: { ...EN, dailyGoal: 20 },
    days: daysSeed(6, { base: FROZEN }),
    srs: srsSeed(),
    progress: {
      streakCurrent: 6,
      streakBest: 7,
      lastGoalDate: dayKey(1, FROZEN),
      totalAnswered: 120,
      totalCorrect: 96,
    },
  });
  await gotoApp(page, { seed: '11' });
  await page.getByRole('button', { name: /Number → in words/ }).click();

  const missedAt = new Set([3, 6, 9]);
  for (let step = 1; step <= 10; step += 1) {
    // The counter is the sync point: it ticks only once the prompt swap has
    // committed, so the numeral read here can never be the outgoing one.
    await expect(page.locator('header').getByText(`${step} of 10`)).toBeVisible();
    const value = await promptNumber(page);
    await page.getByRole('textbox').fill(missedAt.has(step) ? 'novecientos' : numberToWords(value));
    await page.getByRole('button', { name: 'Check' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
  }

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Round complete');
  await page.screenshot({ path: `${OUT}/round-summary.png` });
});
