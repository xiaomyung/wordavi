import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { init } from '@/i18n';
import { ReportScreen } from '@/screens/ReportScreen';
import { composeReport, copyReport, sendReport } from '@/services/report';
import { showToast } from '@/services/toast';

vi.mock('@/services/report', () => ({
  composeReport: vi.fn((input: { userText: string; screenshots: File[] }) => ({
    version: 'test',
    userText: input.userText,
    screenshots: input.screenshots,
  })),
  sendReport: vi.fn(async () => ({ ok: true, channel: 'mailto', manualAttachHint: false })),
  copyReport: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/services/toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/toast')>();
  return { ...actual, showToast: vi.fn() };
});

function renderScreen() {
  const onClose = vi.fn();
  const view = render(<ReportScreen onClose={onClose} />);
  return { ...view, onClose };
}

function attach(container: HTMLElement, ...files: File[]): void {
  const input = container.querySelector('input[type="file"]');
  expect(input).not.toBeNull();
  fireEvent.change(input as HTMLInputElement, { target: { files } });
}

function screenshot(name = 'shot.png'): File {
  return new File(['pixels'], name, { type: 'image/png' });
}

describe('ReportScreen', () => {
  beforeAll(() => {
    init({ initialLang: 'ru' });
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(sendReport).mockResolvedValue({
      ok: true,
      channel: 'mailto',
      manualAttachHint: false,
    });
    vi.mocked(copyReport).mockResolvedValue({ ok: true });
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
  });

  it('renders the note field and the diagnostics summary', () => {
    renderScreen();
    expect(screen.getByPlaceholderText('Опишите, что пошло не так…')).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.startsWith(`v${__APP_VERSION__} · errors `)),
    ).toBeInTheDocument();
  });

  it('lists attached screenshots and removes them again', () => {
    const { container } = renderScreen();
    attach(container, screenshot(), screenshot('second.png'));

    expect(screen.getByAltText('shot.png')).toBeInTheDocument();
    expect(screen.getByAltText('second.png')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Закрыть · shot.png' }));
    expect(screen.queryByAltText('shot.png')).toBeNull();
    expect(screen.getByAltText('second.png')).toBeInTheDocument();
  });

  it('composes the report from the note and the attachments, then sends it', async () => {
    const file = screenshot();
    const { container } = renderScreen();
    fireEvent.change(screen.getByPlaceholderText('Опишите, что пошло не так…'), {
      target: { value: 'кнопка не нажимается' },
    });
    attach(container, file);
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith({ text: 'Отправлено — спасибо!' });
    });
    expect(composeReport).toHaveBeenCalledWith({
      userText: 'кнопка не нажимается',
      screenshots: [file],
    });
    expect(sendReport).toHaveBeenCalledWith(
      expect.objectContaining({ userText: 'кнопка не нажимается' }),
    );
    expect(await screen.findByText('Обычно отвечаем в течение пары дней.')).toBeInTheDocument();
  });

  it('asks for a manual attachment when the report left through mailto', async () => {
    vi.mocked(sendReport).mockResolvedValue({
      ok: true,
      channel: 'mailto',
      manualAttachHint: true,
    });
    const { container } = renderScreen();
    attach(container, screenshot());
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(
      await screen.findByText('Если почта не открылась, приложите скриншот к письму вручную.'),
    ).toBeInTheDocument();
  });

  it('shows the same hint when sending failed outright', async () => {
    vi.mocked(sendReport).mockResolvedValue({
      ok: false,
      channel: 'mailto',
      manualAttachHint: false,
      error: 'boom',
    });
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(
      await screen.findByText('Если почта не открылась, приложите скриншот к письму вручную.'),
    ).toBeInTheDocument();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('copies the diagnostics to the clipboard', async () => {
    renderScreen();
    fireEvent.change(screen.getByPlaceholderText('Опишите, что пошло не так…'), {
      target: { value: 'звук пропал' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Скопировать' }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith({ text: 'Скопировано' });
    });
    expect(composeReport).toHaveBeenCalledWith({ userText: 'звук пропал', screenshots: [] });
    expect(copyReport).toHaveBeenCalled();
  });

  it('says so when the clipboard refused', async () => {
    vi.mocked(copyReport).mockResolvedValue({ ok: false, error: 'denied' });
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Скопировать' }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith({ text: 'Не получилось скопировать' });
    });
  });

  it('closes through its callback', () => {
    const { onClose } = renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(onClose).toHaveBeenCalled();
  });
});
