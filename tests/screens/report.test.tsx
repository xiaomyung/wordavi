import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { init } from '@/i18n';
import { ReportScreen } from '@/screens/ReportScreen';
import { composeReport, copyReport, planReport, sendReport } from '@/services/report';
import { showToast } from '@/services/toast';

vi.mock('@/services/report', () => ({
  composeReport: vi.fn((input: { userText: string; screenshots: File[] }) => ({
    version: 'test',
    userText: input.userText,
    screenshots: input.screenshots,
  })),
  // A browser that cannot share files at all — the desktop default, and what
  // happy-dom is. Specs about the share path override it.
  planReport: vi.fn((screenshots: File[]) => ({
    channel: 'mailto',
    droppedScreenshots: screenshots.length,
  })),
  sendReport: vi.fn(async () => ({
    ok: true,
    channel: 'mailto',
    droppedScreenshots: 0,
  })),
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

const ATTACH_ONE =
  'Скриншот нельзя отправить вместе с письмом — прикрепите его в почте сами. Файл: ekran.png';
/** Matches the warning whatever the count and file names are. */
const ATTACH_ANY = /нельзя отправить вместе с письмом/;
const SEND_FAILED = 'Почта не открылась. Нажмите «Скопировать» и вставьте текст в письмо.';

describe('ReportScreen', () => {
  beforeAll(() => {
    init({ initialLang: 'ru' });
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(planReport).mockImplementation((screenshots) => ({
      channel: 'mailto',
      droppedScreenshots: screenshots.length,
    }));
    vi.mocked(sendReport).mockResolvedValue({
      ok: true,
      channel: 'mailto',
      droppedScreenshots: 0,
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

  it('warns that the screenshot cannot travel before handing over to the mail app', () => {
    const { container } = renderScreen();
    attach(container, screenshot('ekran.png'));

    // Still on the sheet: nothing has been handed off yet.
    expect(sendReport).not.toHaveBeenCalled();
    expect(screen.getByText(ATTACH_ONE)).toBeInTheDocument();
  });

  it('names every file that has to be attached by hand', () => {
    const { container } = renderScreen();
    attach(container, screenshot('one.png'), screenshot('two.png'));

    expect(
      screen.getByText(
        'Скриншоты нельзя отправить вместе с письмом — прикрепите их в почте сами. Файлы: one.png, two.png',
      ),
    ).toBeInTheDocument();
  });

  it('stays quiet when the browser can share the screenshot itself', () => {
    vi.mocked(planReport).mockReturnValue({ channel: 'share', droppedScreenshots: 0 });
    const { container } = renderScreen();
    attach(container, screenshot('ekran.png'));

    expect(screen.queryByText(ATTACH_ANY)).toBeNull();
  });

  it('keeps the warning up after the mail draft opened without the screenshot', async () => {
    vi.mocked(sendReport).mockResolvedValue({
      ok: true,
      channel: 'mailto',
      droppedScreenshots: 1,
    });
    const { container } = renderScreen();
    attach(container, screenshot('ekran.png'));
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(await screen.findByText('Обычно отвечаем в течение пары дней.')).toBeInTheDocument();
    expect(screen.getByText(ATTACH_ONE)).toBeInTheDocument();
  });

  it('takes the warning back when the screenshot is removed', () => {
    const { container } = renderScreen();
    attach(container, screenshot('ekran.png'));
    expect(screen.getByText(ATTACH_ONE)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Закрыть · ekran.png' }));
    expect(screen.queryByText(ATTACH_ANY)).toBeNull();
  });

  it('forgets the last hand-off once the attachments change', async () => {
    vi.mocked(sendReport).mockResolvedValue({
      ok: true,
      channel: 'mailto',
      droppedScreenshots: 1,
    });
    const { container } = renderScreen();
    attach(container, screenshot('ekran.png'));
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(await screen.findByText(ATTACH_ONE)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Закрыть · ekran.png' }));

    expect(screen.queryByText(ATTACH_ANY)).toBeNull();
    expect(screen.queryByText('Обычно отвечаем в течение пары дней.')).toBeNull();
  });

  it('recounts the files when another screenshot joins after a send', async () => {
    vi.mocked(sendReport).mockResolvedValue({
      ok: true,
      channel: 'mailto',
      droppedScreenshots: 1,
    });
    const { container } = renderScreen();
    attach(container, screenshot('one.png'));
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(await screen.findByText(/Файл: one\.png$/)).toBeInTheDocument();

    attach(container, screenshot('two.png'));

    expect(
      screen.getByText(
        'Скриншоты нельзя отправить вместе с письмом — прикрепите их в почте сами. Файлы: one.png, two.png',
      ),
    ).toBeInTheDocument();
  });

  it('points at the copy button when nothing could be sent', async () => {
    vi.mocked(sendReport).mockResolvedValue({
      ok: false,
      channel: 'mailto',
      droppedScreenshots: 0,
      error: 'boom',
    });
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(await screen.findByText(SEND_FAILED)).toBeInTheDocument();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('does not send them to their mail app when no draft ever opened', async () => {
    vi.mocked(sendReport).mockResolvedValue({
      ok: false,
      channel: 'mailto',
      droppedScreenshots: 1,
      error: 'boom',
    });
    const { container } = renderScreen();
    attach(container, screenshot('ekran.png'));
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(await screen.findByText(SEND_FAILED)).toBeInTheDocument();
    expect(screen.queryByText(ATTACH_ANY)).toBeNull();
  });

  it('releases the send button even if the send throws', async () => {
    vi.mocked(sendReport).mockRejectedValue(new Error('URI malformed'));
    renderScreen();
    const send = screen.getByRole('button', { name: 'Отправить' });
    fireEvent.click(send);

    // A stuck spinner would leave no way to send and no way to know why.
    await waitFor(() => {
      expect(send).toBeEnabled();
    });
    expect(await screen.findByText(SEND_FAILED)).toBeInTheDocument();
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
