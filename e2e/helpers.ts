/**
 * Shared end-to-end scaffolding: storage seeding, navigation, and the drill
 * driver every flow spec is built on.
 *
 * Two deliberate choices:
 *
 * 1. **Seeding runs before the app boots.** `seedApp` installs an init script
 *    that writes the `wordavi:*` slots on the first navigation of the context,
 *    so a spec starts from a known dashboard/settings state instead of walking
 *    onboarding first. A marker key makes the write once-per-context, which
 *    keeps `page.reload()` honest: whatever the app persisted survives.
 *
 * 2. **The expected Spanish is computed, not guessed.** Playwright tests run in
 *    node, and `@/engine` is a pure layer with no react/DOM/storage imports, so
 *    the spec can import `numberToWords` directly (relative path — the e2e
 *    tsconfig has no `@/` mapping) and type exactly what the drill grades
 *    against. That gives a real correct-answer path without leaking test-only
 *    hooks into the app.
 */
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { numberToWords } from '../src/engine';
import { STORAGE_KEYS } from '../src/storage/keys';
import { schemaVersion } from '../src/storage/migrations';
import type { DayRow, Progress, Settings } from '../src/storage/types';

/** Set once by the seeding init script so a reload keeps the app's own writes. */
const SEED_MARKER = 'wordavi:e2e-seeded';

/** A wrong answer for a word mode: not a Spanish numeral in any range. */
export const WRONG_WORD = 'zzz';

/** Rounds are short by default — a spec proves the flow, not the stamina. */
export const E2E_ROUND_SIZE = 10;

/* ------------------------------------------------------------------ *
 * Seeding
 * ------------------------------------------------------------------ */

/** Mirrors `defaultSettings()` except for the shorter e2e round and silenced sounds. */
function baseSettings(now: string): Settings {
  return {
    uiLang: 'ru',
    theme: 'light',
    rangeMin: 0,
    rangeMax: 100,
    acceptNoAccents: true,
    roundSize: E2E_ROUND_SIZE,
    speechRate: 'normal',
    dailyGoal: 20,
    soundsEnabled: false,
    lastMode: null,
    onboarded: true,
    updatedAt: now,
  };
}

function baseProgress(now: string): Progress {
  return {
    streakCurrent: 0,
    streakBest: 0,
    lastGoalDate: null,
    bestCombo: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    updatedAt: now,
  };
}

/** One SRS bucket as the session layer serialises it. */
export interface BucketSeed {
  attempts: number;
  correct: number;
  last20: boolean[];
}

export interface SrsSeed {
  version: 1;
  answeredCount: number;
  buckets: Record<string, BucketSeed>;
  wrongQueue: unknown[];
}

export interface SeedOptions {
  /** `false` leaves the onboarding gate closed (only onboarding specs want that). */
  onboarded?: boolean;
  settings?: Partial<Omit<Settings, 'updatedAt'>>;
  progress?: Partial<Omit<Progress, 'updatedAt'>>;
  days?: readonly Omit<DayRow, 'updatedAt'>[];
  srs?: SrsSeed;
}

/**
 * Write the `wordavi:*` slots before the app boots. Call before `page.goto`.
 */
export async function seedApp(page: Page, options: SeedOptions = {}): Promise<void> {
  const now = new Date().toISOString();
  const settings: Settings = {
    ...baseSettings(now),
    ...options.settings,
    onboarded: options.onboarded ?? true,
    updatedAt: now,
  };

  const payload: Record<string, string> = {
    [STORAGE_KEYS.v]: JSON.stringify(schemaVersion),
    [STORAGE_KEYS.settings]: JSON.stringify(settings),
  };

  if (options.progress !== undefined) {
    payload[STORAGE_KEYS.progress] = JSON.stringify({ ...baseProgress(now), ...options.progress });
  }
  if (options.days !== undefined) {
    payload[STORAGE_KEYS.days] = JSON.stringify(
      options.days.map((day) => ({ ...day, updatedAt: now })),
    );
  }
  if (options.srs !== undefined) {
    payload[STORAGE_KEYS.srs] = JSON.stringify({ state: options.srs, updatedAt: now });
  }

  await page.addInitScript(
    ([marker, slots]) => {
      const store = window.localStorage;
      if (store.getItem(marker as string) === '1') return;
      for (const [key, value] of Object.entries(slots as Record<string, string>)) {
        store.setItem(key, value);
      }
      store.setItem(marker as string, '1');
    },
    [SEED_MARKER, payload] as const,
  );
}

/**
 * `YYYY-MM-DD` for a day `offset` days before `base`. Specs that freeze the
 * browser clock must pass the same instant as `base`, or the seeded day rows
 * land outside the streak window the app is looking at.
 */
export function dayKey(offset = 0, base: Date = new Date()): string {
  const date = new Date(base.getTime());
  date.setDate(date.getDate() - offset);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export interface DaysSeedOptions {
  answered?: number;
  correct?: number;
  /** "Today" the run ends on; defaults to the real clock. */
  base?: Date;
}

/** A run of finished days, newest last — enough for stats to leave its empty state. */
export function daysSeed(
  count: number,
  options: DaysSeedOptions = {},
): Omit<DayRow, 'updatedAt'>[] {
  const { answered = 24, correct = 20, base } = options;
  return Array.from({ length: count }, (_, index) => ({
    date: dayKey(count - 1 - index, base ?? new Date()),
    answered,
    correct,
    byGroup: { small: { answered, correct } },
  }));
}

function bucket(attempts: number, correct: number): BucketSeed {
  return {
    attempts,
    correct,
    last20: Array.from({ length: Math.min(20, attempts) }, (_, i) => i < correct),
  };
}

/**
 * SRS state with every display group populated and one clearly shaky group
 * (`big` → thousands), so the stats screen shows bars *and* a "потренировать"
 * flag rather than a wall of zeroes.
 */
export function srsSeed(): SrsSeed {
  return {
    version: 1,
    answeredCount: 120,
    buckets: {
      d0_15: bucket(30, 28),
      teens_fused: bucket(14, 11),
      twenties_fused: bucket(12, 10),
      tens_y: bucket(20, 16),
      tens_round: bucket(10, 9),
      hundreds_reg: bucket(12, 9),
      hundreds_irreg: bucket(8, 5),
      thousands: bucket(10, 3),
      millions: bucket(4, 1),
      decimals: bucket(6, 4),
      price_cents: bucket(14, 11),
      qty_fractions: bucket(8, 6),
      qty_grams: bucket(6, 4),
    },
    wrongQueue: [],
  };
}

/* ------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------ */

/** `page.goto('/')`, optionally with the deterministic `?seed=` (and friends). */
export async function gotoApp(page: Page, query: Record<string, string> = {}): Promise<void> {
  const search = new URLSearchParams(query).toString();
  await page.goto(search === '' ? '/' : `/?${search}`);
}

/** The home dashboard is up (greeting + daily goal card). */
export async function expectHome(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Добр');
  await expect(page.getByText('Дневная цель')).toBeVisible();
}

/** Open a mode from the home list by its RU title. */
export async function startMode(page: Page, title: string | RegExp): Promise<void> {
  await page.getByRole('button', { name: title }).click();
}

/**
 * The big button on home: a round mixed from every available mode. Its label
 * depends on whether anything has been played before.
 */
export async function startRound(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Начать (первый )?раунд$/ }).click();
}

/* ------------------------------------------------------------------ *
 * Drill driving
 * ------------------------------------------------------------------ */

/** "3 из 10" / "3 · ∞" — the header counter, and the drill's swap-safe clock. */
export function drillCounter(page: Page): Locator {
  return page.locator('header').getByText(/^\d+ (из \d+|· ∞)$/);
}

export function answerField(page: Page): Locator {
  return page.getByRole('textbox');
}

/** The numeral on stage, as a number ("1 234" → 1234). */
export async function promptNumber(page: Page): Promise<number> {
  const text = await page.getByTestId('numeral-prompt').innerText();
  const digits = text.replace(/\D/g, '');
  expect(digits, `unreadable numeral prompt: "${text}"`).not.toBe('');
  return Number(digits);
}

/**
 * Answer the question on stage in a word mode. `correct` types the canonical
 * es-ES spelling the engine accepts; otherwise a string no numeral matches.
 */
export async function answerWords(page: Page, correct: boolean): Promise<void> {
  const value = await promptNumber(page);
  await answerField(page).fill(correct ? numberToWords(value) : WRONG_WORD);
  await page.getByRole('button', { name: 'Проверить' }).click();
}

/** The mode title above the prompt — per question in a mixed round. */
export function modeOverline(page: Page): Locator {
  return page.getByTestId('mode-overline');
}

/**
 * Answer whatever is on stage — wrongly, the one path every mode shares, so a
 * mixed round can be played without knowing which mode each question came from.
 * Typed modes get a non-word; the four-tile mode gets its first tile; the
 * microphone mode is answered through its own "type instead" escape hatch.
 */
export async function answerAnything(page: Page): Promise<void> {
  const field = answerField(page);
  if ((await field.count()) === 0) {
    const typeInstead = page.getByRole('button', { name: 'Ввести текстом' });
    if ((await typeInstead.count()) > 0) {
      await typeInstead.click();
    } else {
      // The 2x2 grid: tiles are buttons whose whole label is a numeral.
      await page
        .getByRole('button')
        .filter({ hasText: /^[\d ]+$/ })
        .first()
        .click();
    }
  }
  if ((await field.count()) > 0) await field.fill(WRONG_WORD);
  await page.getByRole('button', { name: 'Проверить' }).click();
}

/** Move past the verdict; the last one ends the round. */
export async function advance(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Дальше' }).click();
}

/**
 * Play a whole fixed round of a word mode. The counter is the sync point: it
 * only ticks once the 120ms prompt swap has committed the next question, so the
 * numeral read below can never belong to the outgoing one.
 */
export async function playWordsRound(page: Page, size: number, correct: boolean): Promise<void> {
  for (let step = 1; step <= size; step += 1) {
    await expect(drillCounter(page)).toHaveText(`${step} из ${size}`);
    await answerWords(page, correct);
    await advance(page);
  }
}

/** The round summary is up. */
export async function expectSummary(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Раунд завершён');
}
