import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  initStorage: vi.fn(),
  setStorageObserver: vi.fn(),
  getSettings: vi.fn(() => ({ uiLang: 'ru', theme: 'dark', soundsEnabled: true })),
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
vi.mock('@/i18n', () => ({ init: services.initI18n }));

async function freshBootstrap(): Promise<() => void> {
  vi.resetModules();
  const module = await import('@/app/bootstrap');
  return module.bootstrap;
}

describe('bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wires storage, error capture, session logging, i18n and the theme', async () => {
    const bootstrap = await freshBootstrap();
    bootstrap();

    expect(storage.initStorage).toHaveBeenCalledTimes(1);
    expect(storage.setStorageObserver).toHaveBeenCalledTimes(1);
    expect(services.installGlobalErrorCapture).toHaveBeenCalledTimes(1);
    expect(services.setSessionLogger).toHaveBeenCalledTimes(1);
    expect(services.initI18n).toHaveBeenCalledWith({ initialLang: 'ru' });
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
