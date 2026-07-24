import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { init, setLanguage } from '@/i18n';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { canPromptInstall, isIos, isStandalone, promptInstall } from '@/services/install';
import { applyTheme } from '@/services/theme';
import { getSettings } from '@/storage';

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

vi.mock('@/services/install', () => ({
  canPromptInstall: vi.fn(() => false),
  isIos: vi.fn(() => false),
  isStandalone: vi.fn(() => false),
  promptInstall: vi.fn(async () => 'accepted'),
}));

function renderScreen() {
  const onDone = vi.fn();
  const view = render(<OnboardingScreen onDone={onDone} />);
  return { ...view, onDone };
}

/** Steps 1 → 4 with the defaults, leaving the screen on the "ready" step. */
function walkToReadyStep(): void {
  fireEvent.click(screen.getByRole('button', { name: /Русский/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));
  fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));
}

function step(): number {
  return Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));
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
  });

  it('opens on the language step with all three choices', () => {
    renderScreen();
    expect(screen.getByText('Привет! · ¡Hola!')).toBeInTheDocument();
    expect(step()).toBe(1);
    for (const name of [/Русский/, /English/, /Español/]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByText('для смелых')).toBeInTheDocument();
  });

  it('sets the language live, persists it and advances', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /English/ }));
    expect(setLanguage).toHaveBeenCalledWith('en');
    expect(getSettings().uiLang).toBe('en');
    expect(screen.getByText('С чего начнём?')).toBeInTheDocument();
    expect(step()).toBe(2);
  });

  it('renders the real practice controls with the stored defaults', () => {
    renderScreen();
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
    fireEvent.click(screen.getByRole('button', { name: /Русский/ }));
    fireEvent.click(screen.getByRole('switch', { name: 'Принимать ответы без акцентов' }));
    expect(getSettings().acceptNoAccents).toBe(false);
  });

  it('walks steps 2 → 3 → 4 and back again', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /Русский/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));

    expect(screen.getByText('Как удобнее?')).toBeInTheDocument();
    expect(step()).toBe(3);
    expect(screen.getByRole('radio', { name: 'Авто' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('slider', { name: 'Скорость речи' })).toBeInTheDocument();
    expect(screen.getByText('ответов в день · можно меньше')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));
    expect(step()).toBe(4);
    expect(screen.getByText('4,75 €')).toBeInTheDocument();
    expect(screen.getByText(/Цель — 20 ответов в день/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(step()).toBe(3);
    expect(screen.getByText('Как удобнее?')).toBeInTheDocument();
  });

  it('applies an app-step change live', () => {
    renderScreen();
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

  it('hides the install button when it can do nothing', () => {
    renderScreen();
    walkToReadyStep();
    expect(screen.queryByRole('button', { name: 'Установить приложение' })).toBeNull();

    vi.mocked(isStandalone).mockReturnValue(true);
    vi.mocked(canPromptInstall).mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));
    expect(screen.queryByRole('button', { name: 'Установить приложение' })).toBeNull();
  });

  it('offers the captured install prompt on the last step', () => {
    vi.mocked(canPromptInstall).mockReturnValue(true);
    renderScreen();
    walkToReadyStep();
    fireEvent.click(screen.getByRole('button', { name: 'Установить приложение' }));
    expect(promptInstall).toHaveBeenCalled();
  });

  it('falls back to the iOS steps when no prompt was captured', () => {
    vi.mocked(isIos).mockReturnValue(true);
    renderScreen();
    walkToReadyStep();
    fireEvent.click(screen.getByRole('button', { name: 'Установить приложение' }));
    expect(screen.getByText('Установить на iPhone')).toBeInTheDocument();
    expect(promptInstall).not.toHaveBeenCalled();
  });
});
