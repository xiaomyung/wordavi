import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { init, setLanguage } from '@/i18n';
import { SettingsScreen } from '@/screens/SettingsScreen';
import {
  canPromptInstall,
  isInstalled,
  isIos,
  isStandalone,
  promptInstall,
} from '@/services/install';
import { setEnabled } from '@/services/sounds';
import { applyTheme } from '@/services/theme';
import { showToast } from '@/services/toast';
import { getVoiceStatus, speak } from '@/services/tts';
import { clearAllData, exportData, getSettings, updateSettings } from '@/storage';

// Partial mocks: the real modules still initialise i18next / storage, only the
// live side effects are swapped for spies so a test can assert them without
// repainting the document or changing the rendered language mid-file.
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

vi.mock('@/services/toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/toast')>();
  return { ...actual, showToast: vi.fn() };
});

vi.mock('@/services/install', async () => {
  const { installMock } = await import('../helpers/mocks');
  return installMock(installBus);
});

// jsdom has no speechSynthesis, so the sample the speech-rate row plays is
// asserted through spies: a voice is present by default (the interesting case),
// and `speak` resolves without making a sound.
vi.mock('@/services/tts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/tts')>();
  return {
    ...actual,
    getVoiceStatus: vi.fn(() => 'es-ES' as const),
    speak: vi.fn(() => Promise.resolve()),
  };
});

// Storage stays real (the screen's whole job is writing to it); clearAllData and
// updateSettings are wrapped in spies that still call through, so a wipe and a
// write count can be asserted as calls as well as by their effect.
vi.mock('@/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/storage')>();
  return {
    ...actual,
    clearAllData: vi.fn(actual.clearAllData),
    updateSettings: vi.fn(actual.updateSettings),
  };
});

/** Stand-in for the reboot the reset performs; wired in beforeEach. */
const reload = vi.fn();

function renderScreen() {
  const onBack = vi.fn();
  const onReport = vi.fn();
  const view = render(<SettingsScreen onBack={onBack} onReport={onReport} />);
  return { ...view, onBack, onReport };
}

function stepper(name: string) {
  return within(screen.getByRole('group', { name }));
}

describe('SettingsScreen', () => {
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
    vi.mocked(getVoiceStatus).mockReturnValue('es-ES');
    vi.mocked(speak).mockResolvedValue(undefined);
    installBus.listeners.clear();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:wordavi'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window.location, 'reload', {
      configurable: true,
      writable: true,
      value: reload,
    });
  });

  it('renders every control with the stored value', () => {
    updateSettings({
      rangeMin: 20,
      rangeMax: 5000,
      acceptNoAccents: false,
      roundSize: 30,
      uiLang: 'ru',
      theme: 'dark',
      speechRate: 'fast',
      dailyGoal: 25,
      soundsEnabled: true,
    });
    renderScreen();

    // The rendered readout groups thousands with a thin space; testing-library
    // collapses it to a plain space before matching.
    expect(screen.getByText('20 — 5 000')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Диапазон чисел — min' })).toHaveAttribute(
      'aria-valuenow',
      '20',
    );
    expect(screen.getByRole('slider', { name: 'Диапазон чисел — max' })).toHaveAttribute(
      'aria-valuenow',
      '5000',
    );
    expect(screen.getByRole('switch', { name: 'Принимать ответы без акцентов' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(stepper('Вопросов в раунде').getByText('30')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Русский' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Тёмная' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('slider', { name: 'Скорость речи' })).toHaveAttribute(
      'aria-valuetext',
      'быстро',
    );
    expect(stepper('Дневная цель').getByText('25')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Звуки ответов' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByText(`wordaví · версия ${__APP_VERSION__}`)).toBeInTheDocument();
  });

  it('shows the range live but writes it once per interaction', () => {
    renderScreen();
    const min = screen.getByRole('slider', { name: 'Диапазон чисел — min' });
    vi.mocked(updateSettings).mockClear();

    fireEvent.keyDown(min, { key: 'ArrowRight' });
    fireEvent.keyDown(min, { key: 'ArrowRight' });
    fireEvent.keyDown(min, { key: 'ArrowRight' });

    // Every step is on screen; none of them reached storage yet.
    expect(min).toHaveAttribute('aria-valuenow', '3');
    expect(screen.getByText('3 — 100')).toBeInTheDocument();
    expect(updateSettings).not.toHaveBeenCalled();

    fireEvent.keyUp(min, { key: 'ArrowRight' });
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(getSettings().rangeMin).toBe(3);

    const max = screen.getByRole('slider', { name: 'Диапазон чисел — max' });
    fireEvent.keyDown(max, { key: 'PageUp' });
    fireEvent.keyUp(max, { key: 'PageUp' });
    expect(updateSettings).toHaveBeenCalledTimes(2);
    expect(getSettings().rangeMax).toBe(1000);
  });

  it('persists the accept-without-accents toggle', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('switch', { name: 'Принимать ответы без акцентов' }));
    expect(getSettings().acceptNoAccents).toBe(false);
  });

  it('cycles the round stepper 10 → 20 → 30 → ∞ and back', () => {
    renderScreen();
    const group = stepper('Вопросов в раунде');
    const increase = group.getByRole('button', { name: 'Increase' });
    const decrease = group.getByRole('button', { name: 'Decrease' });

    expect(group.getByText('20')).toBeInTheDocument();
    fireEvent.click(increase);
    expect(getSettings().roundSize).toBe(30);
    fireEvent.click(increase);
    expect(getSettings().roundSize).toBe('endless');
    expect(stepper('Вопросов в раунде').getByText('∞')).toBeInTheDocument();
    fireEvent.click(increase);
    expect(getSettings().roundSize).toBe(10);
    fireEvent.click(decrease);
    expect(getSettings().roundSize).toBe('endless');
  });

  it('switches the interface language live and persists it', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(setLanguage).toHaveBeenCalledWith('en');
    expect(getSettings().uiLang).toBe('en');
  });

  it('applies the theme live and persists it', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('radio', { name: 'Тёмная' }));
    expect(applyTheme).toHaveBeenCalledWith('dark');
    expect(getSettings().theme).toBe('dark');
  });

  it('persists the speech rate once the thumb settles, then plays a sample at it', () => {
    renderScreen();
    const slider = screen.getByRole('slider', { name: 'Скорость речи' });
    vi.mocked(updateSettings).mockClear();

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuetext', 'быстро');
    expect(updateSettings).not.toHaveBeenCalled();
    // A stop the thumb only passed through is not worth speaking.
    expect(speak).not.toHaveBeenCalled();

    fireEvent.keyUp(slider, { key: 'ArrowRight' });
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(getSettings().speechRate).toBe('fast');
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith('cuatrocientos setenta y cinco', { rate: 'fast' });
  });

  it('samples every interaction, letting tts cut the one still playing', () => {
    renderScreen();
    const slider = screen.getByRole('slider', { name: 'Скорость речи' });

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.keyUp(slider, { key: 'ArrowRight' });
    fireEvent.keyDown(slider, { key: 'Home' });
    fireEvent.keyUp(slider, { key: 'Home' });

    expect(speak).toHaveBeenCalledTimes(2);
    expect(vi.mocked(speak).mock.calls.map(([, options]) => options?.rate)).toEqual([
      'fast',
      'slow',
    ]);
    expect(getSettings().speechRate).toBe('slow');
  });

  it('still persists the rate but says nothing when the device has no Spanish voice', () => {
    vi.mocked(getVoiceStatus).mockReturnValue('none');
    renderScreen();
    const slider = screen.getByRole('slider', { name: 'Скорость речи' });

    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    fireEvent.keyUp(slider, { key: 'ArrowLeft' });

    expect(getSettings().speechRate).toBe('slow');
    expect(speak).not.toHaveBeenCalled();
  });

  it('steps the daily goal by five and clamps at both ends', () => {
    updateSettings({ dailyGoal: 45 });
    renderScreen();
    const group = stepper('Дневная цель');
    fireEvent.click(group.getByRole('button', { name: 'Increase' }));
    expect(getSettings().dailyGoal).toBe(50);
    expect(stepper('Дневная цель').getByRole('button', { name: 'Increase' })).toBeDisabled();

    const decrease = stepper('Дневная цель').getByRole('button', { name: 'Decrease' });
    fireEvent.click(decrease);
    expect(getSettings().dailyGoal).toBe(45);
  });

  it('enables answer sounds live and persists them', () => {
    updateSettings({ soundsEnabled: false });
    renderScreen();
    const toggle = screen.getByRole('switch', { name: 'Звуки ответов' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(setEnabled).toHaveBeenCalledWith(true);
    expect(getSettings().soundsEnabled).toBe(true);
  });

  it('downloads a dated backup file and toasts', () => {
    const clicks = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /Скачать данные/ }));

    expect(URL.createObjectURL).toHaveBeenCalled();
    const anchor = clicks.mock.contexts[0] as HTMLAnchorElement | undefined;
    const today = new Date().toISOString().slice(0, 10);
    expect(anchor?.download).toBe(`wordavi-backup-${today}.json`);
    expect(showToast).toHaveBeenCalledWith({ text: 'Файл сохранён' });
    clicks.mockRestore();
  });

  it('restores a backup, re-applying the imported language and theme', async () => {
    const bundle = JSON.parse(exportData()) as { settings: Record<string, unknown> };
    bundle.settings.uiLang = 'en';
    bundle.settings.theme = 'dark';
    bundle.settings.dailyGoal = 35;
    const file = new File([JSON.stringify(bundle)], 'wordavi-backup.json', {
      type: 'application/json',
    });

    const { container } = renderScreen();
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith({ text: 'Данные восстановлены' });
    });
    expect(getSettings().uiLang).toBe('en');
    expect(setLanguage).toHaveBeenCalledWith('en');
    expect(applyTheme).toHaveBeenCalledWith('dark');
    expect(stepper('Дневная цель').getByText('35')).toBeInTheDocument();
  });

  it('toasts when the picked file is not a wordavi backup', async () => {
    const file = new File(['{ not json'], 'notes.json', { type: 'application/json' });
    const { container } = renderScreen();
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith({ text: 'Не получилось прочитать файл' });
    });
  });

  it('hides the install row when the app already runs standalone', () => {
    vi.mocked(isStandalone).mockReturnValue(true);
    vi.mocked(canPromptInstall).mockReturnValue(true);
    renderScreen();
    expect(screen.queryByRole('button', { name: /Установить приложение/ })).toBeNull();
  });

  it('offers the browser-menu recipe when no prompt was captured', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /Установить приложение/ }));

    expect(screen.getByText('Установить через меню браузера')).toBeInTheDocument();
    expect(screen.getByText(/Откройте меню браузера/)).toBeInTheDocument();
    expect(promptInstall).not.toHaveBeenCalled();
  });

  it('hides the install row when the device says the app is installed', async () => {
    vi.mocked(isInstalled).mockResolvedValue(true);
    renderScreen();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Установить приложение/ })).toBeNull();
    });
  });

  it('fires the captured install prompt from the install row', () => {
    vi.mocked(canPromptInstall).mockReturnValue(true);
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /Установить приложение/ }));
    expect(promptInstall).toHaveBeenCalled();
  });

  it('shows the iOS add-to-home-screen steps instead of the generic recipe', () => {
    vi.mocked(isIos).mockReturnValue(true);
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /Установить приложение/ }));
    expect(screen.getByText('Установить на iPhone')).toBeInTheDocument();
    expect(screen.queryByText('Установить через меню браузера')).toBeNull();
    expect(screen.getByText(/Нажмите «Поделиться»/)).toBeInTheDocument();
    expect(screen.getByText(/На экран Домой/)).toBeInTheDocument();
    expect(promptInstall).not.toHaveBeenCalled();
  });

  it('reports navigation through its callbacks', () => {
    const { onBack, onReport } = renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(onBack).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Сообщить о проблеме' }));
    expect(onReport).toHaveBeenCalled();
  });

  describe('reset all data', () => {
    function openConfirm(): void {
      fireEvent.click(screen.getByRole('button', { name: 'Сбросить все данные' }));
    }

    it('confirms in place instead of opening a browser dialog', () => {
      renderScreen();
      openConfirm();

      expect(
        screen.getByText('Удалит весь прогресс и настройки. Это действие необратимо.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Удалить всё' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Отмена' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Сбросить все данные' })).toBeNull();
    });

    it('restores the row on cancel, touching nothing', () => {
      updateSettings({ dailyGoal: 35 });
      renderScreen();
      openConfirm();
      fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));

      expect(screen.getByRole('button', { name: 'Сбросить все данные' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Удалить всё' })).toBeNull();
      expect(clearAllData).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
      expect(getSettings().dailyGoal).toBe(35);
    });

    it('wipes every wordavi key and reboots on confirm', () => {
      updateSettings({ dailyGoal: 35 });
      renderScreen();
      openConfirm();
      fireEvent.click(screen.getByRole('button', { name: 'Удалить всё' }));

      expect(clearAllData).toHaveBeenCalled();
      const leftovers: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key?.startsWith('wordavi:')) leftovers.push(key);
      }
      expect(leftovers).toEqual([]);
      expect(reload).toHaveBeenCalled();
    });
  });
});
