import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    // A first run takes its language from the browser (app/bootstrap.ts), so
    // the locale decides what an un-onboarded spec reads on screen. Pinned to
    // Russian — the primary user's language, and what every spec asserts —
    // instead of inheriting the CI host's locale.
    locale: 'ru-RU',
    // A precache answering navigations would make every other spec depend on
    // the previous run's build. pwa.spec.ts opts back in with test.use().
    serviceWorkers: 'block',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // Serves dist as-is. `pnpm e2e` builds it first with `pnpm build:e2e` — the
    // production build plus the component gallery, which three specs here open;
    // a plain `pnpm build` compiles that gallery out. Driving Playwright
    // directly tests whatever dist happens to hold.
    command: `pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
