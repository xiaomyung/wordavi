import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { init } from '@/i18n';
import { CrashScreen } from '@/screens/CrashScreen';

function renderScreen() {
  const onRestart = vi.fn();
  const onReport = vi.fn();
  const view = render(<CrashScreen onRestart={onRestart} onReport={onReport} />);
  return { ...view, onRestart, onReport };
}

describe('CrashScreen', () => {
  beforeAll(() => {
    init({ initialLang: 'ru' });
  });

  it('apologises without technical detail', () => {
    renderScreen();
    expect(screen.getByRole('heading', { name: 'Что-то пошло не так' })).toBeInTheDocument();
    expect(
      screen.getByText('Простите за неудобство — попробуйте начать заново.'),
    ).toBeInTheDocument();
  });

  it('restarts through its callback', () => {
    const { onRestart, onReport } = renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Перезапустить' }));
    expect(onRestart).toHaveBeenCalled();
    expect(onReport).not.toHaveBeenCalled();
  });

  it('opens the report screen through its callback', () => {
    const { onRestart, onReport } = renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Сообщить о проблеме' }));
    expect(onReport).toHaveBeenCalled();
    expect(onRestart).not.toHaveBeenCalled();
  });
});
