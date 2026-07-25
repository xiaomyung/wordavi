import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n, { init, setLanguage } from '@/i18n';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import {
  canPromptInstall,
  isInstalled,
  isIos,
  isStandalone,
  promptInstall,
} from '@/services/install';
import { applyTheme } from '@/services/theme';
import { getSettings, updateSettings } from '@/storage';

/** Stands in for the service's own availability bus (prompt captured / installed). */
const installBus = vi.hoisted(() => ({ listeners: new Set<() => void>() }));

vi.mock('@/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/i18n')>();
  return { ...actual, setLanguage: vi.fn() };
});

vi.mock('@/services/theme', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/theme')>();
  return { ...actual, applyTheme: vi.fn() };
});

vi.mock('@/services/sounds', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/sounds')>();
  return { ...actual, setEnabled: vi.fn() };
});

vi.mock('@/services/install', async () => {
  const { installMock } = await import('../helpers/mocks');
  return installMock(installBus);
});

function renderScreen() {
  const onDone = vi.fn();
  const view = render(<OnboardingScreen onDone={onDone} />);
  return { ...view, onDone };
}

/**
 * Leave the install step. In the default test environment nothing captured a
 * `beforeinstallprompt` and this is not iOS, so the affordance is 'manual' and
 * the step is the first thing on screen — exactly like Brave, Firefox or dev.
 */
function skipInstall(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить в браузере' }));
}

/** Install → language → practice → app, leaving the screen on the "ready" step. */
function walkToReadyStep(): void {
  skipInstall();
  fireEvent.click(screen.getByRole('button', { name: /Русский/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));
  fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));
}

function step(): number {
  return Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));
}

/** Mirrors the screen's own auto-advance delay after a successful install. */
const INSTALL_ADVANCE_MS = 1200;

function stepCount(): number {
  return Number(screen.getByRole('progressbar').getAttribute('aria-valuemax'));
}

/** A getUserMedia that hands back one stoppable audio track. */
function grantingMedia(stop: () => void) {
  return {
    getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })),
  } as unknown as MediaDevices;
}

function denyingMedia(reason = 'NotAllowedError') {
  return {
    getUserMedia: vi.fn(async () => {
      throw new Error(reason);
    }),
  } as unknown as MediaDevices;
}

function setMediaDevices(value: MediaDevices | undefined): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    writable: true,
    value,
  });
}

describe('OnboardingScreen', () => {
  beforeAll(() => {
    init({ initialLang: 'ru' });
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isStandalone).mockReturnValue(false);
    vi.mocked(canPromptInstall).mockReturnValue(false);
    vi.mocked(isIos).mockReturnValue(false);
    vi.mocked(promptInstall).mockResolvedValue('accepted');
    vi.mocked(isInstalled).mockResolvedValue(false);
    installBus.listeners.clear();
    setMediaDevices(grantingMedia(() => undefined));
  });

  it('opens on the language step with all three choices', () => {
    const { container } = renderScreen();
    skipInstall();
    expect(screen.getByText('Привет! · ¡Hola!')).toBeInTheDocument();
    expect(step()).toBe(2);

    // The tile is the shared app mark: brand tile, w + acute, no punch hole.
    const tile = container.querySelector('[data-step="1"] [data-app-tile]');
    expect(tile).not.toBeNull();
    expect(tile).toHaveClass('bg-brand-tile', 'text-brand-glyph');
    expect(tile?.querySelectorAll('svg path')).toHaveLength(2);

    for (const name of [/Русский/, /English/, /Español/]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByText('для смелых')).toBeInTheDocument();
  });

  it('opens in the detected language and highlights it', async () => {
    // What bootstrap does on a first run in an English browser: the detected
    // language is already stored and in force before onboarding renders.
    updateSettings({ uiLang: 'en' });
    await act(async () => {
      await i18n.changeLanguage('en');
    });
    try {
      renderScreen();

      // Step one speaks it too, before any language button has been touched.
      expect(screen.getByText('Install it on your phone')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Continue in the browser' }));

      const english = screen.getByRole('button', { name: /English/ });
      expect(english).toHaveClass('bg-accent');
      expect(english).toHaveAttribute('aria-current', 'true');
      expect(screen.getByRole('button', { name: /Русский/ })).not.toHaveClass('bg-accent');
    } finally {
      await act(async () => {
        await i18n.changeLanguage('ru');
      });
    }
  });

  it('sets the language live, persists it and advances', () => {
    renderScreen();
    skipInstall();
    fireEvent.click(screen.getByRole('button', { name: /English/ }));
    expect(setLanguage).toHaveBeenCalledWith('en');
    expect(getSettings().uiLang).toBe('en');
    expect(screen.getByText('С чего начнём?')).toBeInTheDocument();
    expect(step()).toBe(3);
  });

  it('renders the real practice controls with the stored defaults', () => {
    renderScreen();
    skipInstall();
    fireEvent.click(screen.getByRole('button', { name: /Русский/ }));

    expect(screen.getByText('0 — 100')).toBeInTheDocument();
    expect(screen.getByText(/для магазина хватит 0–100/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Принимать ответы без акцентов' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(
      within(screen.getByRole('group', { name: 'Вопросов в раунде' })).getByText('20'),
    ).toBeInTheDocument();
  });

  it('writes practice changes straight to settings', () => {
    renderScreen();
    skipInstall();
    fireEvent.click(screen.getByRole('button', { name: /Русский/ }));
    fireEvent.click(screen.getByRole('switch', { name: 'Принимать ответы без акцентов' }));
    expect(getSettings().acceptNoAccents).toBe(false);
  });

  it('walks the settings steps and back again', () => {
    renderScreen();
    skipInstall();
    fireEvent.click(screen.getByRole('button', { name: /Русский/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));

    expect(screen.getByText('Как удобнее?')).toBeInTheDocument();
    expect(step()).toBe(4);
    expect(screen.getByRole('radio', { name: 'Авто' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('slider', { name: 'Скорость речи' })).toBeInTheDocument();
    expect(screen.getByText('ответов в день · можно меньше')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));
    expect(step()).toBe(5);
    expect(screen.getByText('4,75 €')).toBeInTheDocument();
    expect(screen.getByText(/Цель — 20 ответов в день/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(step()).toBe(4);
    expect(screen.getByText('Как удобнее?')).toBeInTheDocument();
  });

  it('applies an app-step change live', () => {
    renderScreen();
    skipInstall();
    fireEvent.click(screen.getByRole('button', { name: /Русский/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Светлая' }));
    expect(applyTheme).toHaveBeenCalledWith('light');
    expect(getSettings().theme).toBe('light');
  });

  it('finishes into the first round', () => {
    const { onDone } = renderScreen();
    walkToReadyStep();
    fireEvent.click(screen.getByRole('button', { name: 'Начать первый раунд' }));
    expect(getSettings().onboarded).toBe(true);
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it('finishes into the mode list', () => {
    const { onDone } = renderScreen();
    walkToReadyStep();
    fireEvent.click(screen.getByRole('button', { name: 'Сначала посмотреть режимы' }));
    expect(getSettings().onboarded).toBe(true);
    expect(onDone).toHaveBeenCalledWith(false);
  });

  it('cross-fades every step change, forward and back', async () => {
    const { container } = renderScreen();
    expect(container.querySelector('[data-step="0"]')).toHaveClass('wa-step-enter');
    expect(container.querySelector('.wa-step-leave')).toBeNull();
    skipInstall();
    await waitFor(() => {
      expect(container.querySelector('.wa-step-leave')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /Русский/ }));
    expect(container.querySelector('[data-step="2"]')).toHaveClass('wa-step-enter');
    const leaving = container.querySelector('.wa-step-leave');
    expect(leaving).not.toBeNull();
    // The outgoing copy is scenery only: out of the a11y tree, untouchable.
    expect(leaving).toHaveAttribute('aria-hidden', 'true');
    await waitFor(() => {
      expect(container.querySelector('.wa-step-leave')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(container.querySelector('[data-step="2"]')).toHaveClass('wa-step-enter');
    expect(container.querySelector('.wa-step-leave')).not.toBeNull();
    await waitFor(() => {
      expect(container.querySelector('.wa-step-leave')).toBeNull();
    });
  });

  describe('install step', () => {
    it('leads with the browser-menu recipe when no prompt event exists', () => {
      // Brave disables beforeinstallprompt by policy; Firefox has no such event.
      renderScreen();
      expect(screen.getByText('Установите на телефон')).toBeInTheDocument();
      expect(step()).toBe(1);
      expect(stepCount()).toBe(5);

      fireEvent.click(screen.getByRole('button', { name: 'Установить приложение' }));
      expect(screen.getByText('Установить через меню браузера')).toBeInTheDocument();
      expect(screen.getByText(/Откройте меню браузера/)).toBeInTheDocument();
      expect(promptInstall).not.toHaveBeenCalled();
    });

    it('steps aside when the device reports the app already installed', async () => {
      vi.mocked(isInstalled).mockResolvedValue(true);
      renderScreen();

      // Auto-advance, then the cross-fade copy of the install step retires too.
      await waitFor(() => {
        expect(screen.getByText('Привет! · ¡Hola!')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.queryByText('Установите на телефон')).toBeNull();
      });
    });

    it('is skipped when the app already runs standalone', () => {
      vi.mocked(isStandalone).mockReturnValue(true);
      vi.mocked(canPromptInstall).mockReturnValue(true);
      renderScreen();
      expect(screen.queryByText('Установите на телефон')).toBeNull();
      expect(stepCount()).toBe(4);
    });

    it('leads the flow when a prompt was captured', () => {
      vi.mocked(canPromptInstall).mockReturnValue(true);
      renderScreen();

      expect(screen.getByText('Установите на телефон')).toBeInTheDocument();
      expect(step()).toBe(1);
      expect(stepCount()).toBe(5);
      fireEvent.click(screen.getByRole('button', { name: 'Установить приложение' }));
      expect(promptInstall).toHaveBeenCalled();
    });

    it('shows the iOS recipe instead of the generic one', () => {
      vi.mocked(isIos).mockReturnValue(true);
      renderScreen();

      expect(stepCount()).toBe(5);
      fireEvent.click(screen.getByRole('button', { name: 'Установить приложение' }));
      expect(screen.getByText('Установить на iPhone')).toBeInTheDocument();
      expect(screen.queryByText('Установить через меню браузера')).toBeNull();
      expect(promptInstall).not.toHaveBeenCalled();
    });

    it('continues in the browser without installing', () => {
      vi.mocked(canPromptInstall).mockReturnValue(true);
      renderScreen();
      fireEvent.click(screen.getByRole('button', { name: 'Продолжить в браузере' }));

      expect(screen.getByText('Привет! · ¡Hola!')).toBeInTheDocument();
      expect(step()).toBe(2);
      expect(promptInstall).not.toHaveBeenCalled();
    });

    it('confirms an accepted install, then moves on by itself', async () => {
      vi.useFakeTimers();
      try {
        vi.mocked(canPromptInstall).mockReturnValue(true);
        renderScreen();

        fireEvent.click(screen.getByRole('button', { name: 'Установить приложение' }));
        await act(async () => undefined);

        expect(screen.getByRole('status')).toHaveTextContent(/Установлено!/);
        expect(screen.queryByRole('button', { name: 'Установить приложение' })).toBeNull();
        expect(step()).toBe(1);

        await act(async () => {
          vi.advanceTimersByTime(INSTALL_ADVANCE_MS);
        });
        expect(step()).toBe(2);
        expect(screen.getByText('Привет! · ¡Hola!')).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('takes the browser appinstalled event as a success too', async () => {
      vi.useFakeTimers();
      try {
        vi.mocked(canPromptInstall).mockReturnValue(true);
        renderScreen();

        await act(async () => {
          window.dispatchEvent(new Event('appinstalled'));
        });
        expect(screen.getByRole('status')).toHaveTextContent(/Установлено!/);

        await act(async () => {
          vi.advanceTimersByTime(INSTALL_ADVANCE_MS);
        });
        expect(step()).toBe(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('stays out of the way of a dismissed prompt', async () => {
      vi.mocked(canPromptInstall).mockReturnValue(true);
      vi.mocked(promptInstall).mockResolvedValue('dismissed');
      renderScreen();

      fireEvent.click(screen.getByRole('button', { name: 'Установить приложение' }));
      await act(async () => undefined);

      expect(screen.queryByRole('status')).toBeNull();
      expect(step()).toBe(1);
      expect(screen.getByRole('button', { name: 'Установить приложение' })).toBeInTheDocument();
    });
  });

  describe('microphone card', () => {
    it('asks on the last step and confirms a grant', async () => {
      const stop = vi.fn();
      setMediaDevices(grantingMedia(stop));
      renderScreen();
      walkToReadyStep();

      expect(screen.getByText('Микрофон — для режима «Скажите вслух»')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Разрешить микрофон' }));

      expect(await screen.findByText('готово')).toBeInTheDocument();
      // The permission is the point; the track is released immediately.
      expect(stop).toHaveBeenCalled();
    });

    it('stays friendly when the mic is refused', async () => {
      setMediaDevices(denyingMedia());
      const { onDone } = renderScreen();
      walkToReadyStep();
      fireEvent.click(screen.getByRole('button', { name: 'Разрешить микрофон' }));

      expect(await screen.findByText('можно позже — в настройках браузера')).toBeInTheDocument();

      // And the CTA never depended on it.
      fireEvent.click(screen.getByRole('button', { name: 'Начать первый раунд' }));
      expect(onDone).toHaveBeenCalledWith(true);
    });

    it('is absent when the browser has no getUserMedia', () => {
      setMediaDevices(undefined);
      renderScreen();
      walkToReadyStep();

      expect(screen.queryByText('Микрофон — для режима «Скажите вслух»')).toBeNull();
      expect(screen.getByRole('button', { name: 'Начать первый раунд' })).toBeInTheDocument();
    });
  });
});
