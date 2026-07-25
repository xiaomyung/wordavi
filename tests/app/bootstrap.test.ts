import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  initStorage: vi.fn(),
  setStorageObserver: vi.fn(),
  getSettings: vi.fn(() => ({
    uiLang: 'ru',
    theme: 'dark',
    soundsEnabled: true,
    onboarded: true,
  })),
  updateSettings: vi.fn(),
}));

const services = vi.hoisted(() => ({
  installGlobalErrorCapture: vi.fn(() => () => {}),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  applyTheme: vi.fn(),
  setSoundsEnabled: vi.fn(),
  setSessionLogger: vi.fn(),
  initI18n: vi.fn(),
}));

vi.mock('@/storage', () => storage);
vi.mock('@/services/log', () => ({
  installGlobalErrorCapture: services.installGlobalErrorCapture,
  log: services.log,
}));
vi.mock('@/services/theme', () => ({ applyTheme: services.applyTheme }));
vi.mock('@/services/sounds', () => ({ setEnabled: services.setSoundsEnabled }));
vi.mock('@/session', () => ({ setSessionLogger: services.setSessionLogger }));
// `detectLanguage` stays real: the first-run language is exactly the behaviour
// under test here, and it is a pure function of `navigator.languages`.
vi.mock('@/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/i18n')>();
  return { init: services.initI18n, detectLanguage: actual.detectLanguage };
});

async function freshBootstrap(): Promise<() => void> {
  vi.resetModules();
  const module = await import('@/app/bootstrap');
  return module.bootstrap;
}

/** The browser's language list, as `detectLanguage` reads it. */
function setBrowserLanguages(languages: readonly string[]): void {
  Object.defineProperty(navigator, 'languages', {
    configurable: true,
    writable: true,
    value: [...languages],
  });
  Object.defineProperty(navigator, 'language', {
    configurable: true,
    writable: true,
    value: languages[0] ?? 'en',
  });
}

/** Storage as it reads on a first ever visit: nothing chosen, nothing onboarded. */
function firstRunSettings(): void {
  storage.getSettings.mockReturnValue({
    uiLang: 'ru',
    theme: 'auto',
    soundsEnabled: true,
    onboarded: false,
  });
}

describe('bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getSettings.mockReturnValue({
      uiLang: 'ru',
      theme: 'dark',
      soundsEnabled: true,
      onboarded: true,
    });
  });

  it('wires storage, error capture, session logging, i18n and the theme', async () => {
    const bootstrap = await freshBootstrap();
    bootstrap();

    expect(storage.initStorage).toHaveBeenCalledTimes(1);
    expect(storage.setStorageObserver).toHaveBeenCalledTimes(1);
    expect(services.installGlobalErrorCapture).toHaveBeenCalledTimes(1);
    expect(services.setSessionLogger).toHaveBeenCalledTimes(1);
    expect(services.initI18n).toHaveBeenCalledWith({ initialLang: 'ru' });
    expect(storage.updateSettings).not.toHaveBeenCalled();
    expect(services.applyTheme).toHaveBeenCalledWith('dark');
    expect(services.setSoundsEnabled).toHaveBeenCalledWith(true);
    expect(services.log.info).toHaveBeenCalledWith('app', 'boot', expect.anything());
  });

  it('routes storage recovery events to the logger as warnings', async () => {
    const bootstrap = await freshBootstrap();
    bootstrap();

    const observer = storage.setStorageObserver.mock.calls[0]?.[0] as (event: unknown) => void;
    observer({ key: 'wordavi:srs', kind: 'corrupt' });

    expect(services.log.warn).toHaveBeenCalledWith('storage', 'slot recovered', {
      key: 'wordavi:srs',
      kind: 'corrupt',
    });
  });

  describe('first-run language', () => {
    it('greets a first-time visitor in their browser language and persists it', async () => {
      firstRunSettings();
      setBrowserLanguages(['es-ES', 'es']);

      const bootstrap = await freshBootstrap();
      bootstrap();

      expect(services.initI18n).toHaveBeenCalledWith({ initialLang: 'es' });
      expect(storage.updateSettings).toHaveBeenCalledWith({ uiLang: 'es' });
    });

    it('takes the first supported entry, not the first entry', async () => {
      firstRunSettings();
      setBrowserLanguages(['fr', 'es-MX']);

      const bootstrap = await freshBootstrap();
      bootstrap();

      expect(services.initI18n).toHaveBeenCalledWith({ initialLang: 'es' });
      expect(storage.updateSettings).toHaveBeenCalledWith({ uiLang: 'es' });
    });

    it('falls back to English for a language the app does not ship', async () => {
      firstRunSettings();
      setBrowserLanguages(['de-DE', 'de']);

      const bootstrap = await freshBootstrap();
      bootstrap();

      expect(services.initI18n).toHaveBeenCalledWith({ initialLang: 'en' });
      expect(storage.updateSettings).toHaveBeenCalledWith({ uiLang: 'en' });
    });

    it('leaves an onboarded learner on their stored choice', async () => {
      setBrowserLanguages(['es-ES']);

      const bootstrap = await freshBootstrap();
      bootstrap();

      expect(services.initI18n).toHaveBeenCalledWith({ initialLang: 'ru' });
      expect(storage.updateSettings).not.toHaveBeenCalled();
    });

    it('writes nothing when the detected language already matches storage', async () => {
      firstRunSettings();
      setBrowserLanguages(['ru-RU']);

      const bootstrap = await freshBootstrap();
      bootstrap();

      expect(services.initI18n).toHaveBeenCalledWith({ initialLang: 'ru' });
      expect(storage.updateSettings).not.toHaveBeenCalled();
    });
  });

  it('is idempotent — a second call installs nothing twice', async () => {
    const bootstrap = await freshBootstrap();
    bootstrap();
    bootstrap();
    bootstrap();

    expect(storage.initStorage).toHaveBeenCalledTimes(1);
    expect(services.installGlobalErrorCapture).toHaveBeenCalledTimes(1);
    expect(services.initI18n).toHaveBeenCalledTimes(1);
  });
});
