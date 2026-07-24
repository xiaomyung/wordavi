import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

/** Language → practice → app → ready, ending on "look at the modes first". */
async function completeOnboarding(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Look at the modes first' }).click();
}

test('a first visit walks onboarding through to home', async ({ page }) => {
  await page.goto('/');

  // A learner who has never opened the app lands in onboarding, not on home.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hello!');

  await completeOnboarding(page);

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Good');
  await expect(page.getByText('Daily goal')).toBeVisible();
});

test('settings show the running version', async ({ page }) => {
  await completeOnboarding(page);

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText(`wordaví · version ${pkg.version}`)).toBeVisible();
});
