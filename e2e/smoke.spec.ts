import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

test('in-progress page loads with wordmark and version', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('word');
  await expect(page.getByText('Learning Spanish numbers — coming soon.')).toBeVisible();
  await expect(page.getByText('Учим испанские числа — скоро.')).toBeVisible();
  await expect(page.locator('footer')).toHaveText(`v${pkg.version}`);
});
