import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MicButton } from '@/components/MicButton';

describe('MicButton', () => {
  it('starts and ends a hold via pointer press/release', () => {
    const onHoldStart = vi.fn();
    const onHoldEnd = vi.fn();
    const { container } = render(
      <MicButton
        state="idle"
        onHoldStart={onHoldStart}
        onHoldEnd={onHoldEnd}
        aria-label="Держите и говорите"
      />,
    );
    const button = screen.getByRole('button', { name: 'Держите и говорите' });

    // idle: no pulsing rings
    expect(container.querySelectorAll('.wa-mic-ring')).toHaveLength(0);

    fireEvent.pointerDown(button, { pointerId: 1 });
    expect(onHoldStart).toHaveBeenCalledTimes(1);
    expect(onHoldEnd).not.toHaveBeenCalled();

    fireEvent.pointerUp(button, { pointerId: 1 });
    expect(onHoldEnd).toHaveBeenCalledTimes(1);
    // a second pointer-up does not re-fire
    fireEvent.pointerUp(button, { pointerId: 1 });
    expect(onHoldEnd).toHaveBeenCalledTimes(1);
  });

  it('holds on Space keydown/keyup and ignores auto-repeat', () => {
    const onHoldStart = vi.fn();
    const onHoldEnd = vi.fn();
    render(
      <MicButton state="idle" onHoldStart={onHoldStart} onHoldEnd={onHoldEnd} aria-label="speak" />,
    );
    const button = screen.getByRole('button');

    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.keyDown(button, { key: ' ', repeat: true });
    fireEvent.keyDown(button, { key: ' ', repeat: true });
    expect(onHoldStart).toHaveBeenCalledTimes(1);

    fireEvent.keyUp(button, { key: ' ' });
    expect(onHoldEnd).toHaveBeenCalledTimes(1);
  });

  it('holds on Enter keydown/keyup', () => {
    const onHoldStart = vi.fn();
    const onHoldEnd = vi.fn();
    render(
      <MicButton state="idle" onHoldStart={onHoldStart} onHoldEnd={onHoldEnd} aria-label="speak" />,
    );
    const button = screen.getByRole('button');

    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onHoldStart).toHaveBeenCalledTimes(1);
    fireEvent.keyUp(button, { key: 'Enter' });
    expect(onHoldEnd).toHaveBeenCalledTimes(1);
  });

  it('ends the hold when the pointer is cancelled', () => {
    // A scroll/gesture takeover fires pointercancel instead of pointerup;
    // without this the mic would stay stuck "listening".
    const onHoldStart = vi.fn();
    const onHoldEnd = vi.fn();
    render(
      <MicButton state="idle" onHoldStart={onHoldStart} onHoldEnd={onHoldEnd} aria-label="speak" />,
    );
    const button = screen.getByRole('button');

    fireEvent.pointerDown(button, { pointerId: 1 });
    expect(onHoldStart).toHaveBeenCalledTimes(1);
    fireEvent.pointerCancel(button, { pointerId: 1 });
    expect(onHoldEnd).toHaveBeenCalledTimes(1);
  });

  it('ignores keys that are not the hold keys', () => {
    const onHoldStart = vi.fn();
    render(<MicButton state="idle" onHoldStart={onHoldStart} aria-label="speak" />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'a' });
    expect(onHoldStart).not.toHaveBeenCalled();
  });

  it('holding shows two rings and marks aria-pressed', () => {
    const { container } = render(<MicButton state="holding" aria-label="speak" />);
    expect(container.querySelectorAll('.wa-mic-ring')).toHaveLength(2);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('passes className to the wrapper, not the button', () => {
    // The rings are positioned against the wrapper, so layout classes belong
    // there; the ref is what reaches the button.
    const { container } = render(<MicButton state="idle" className="my-6" aria-label="speak" />);
    expect(container.querySelector('.wa-mic-wrap')).toHaveClass('my-6');
    expect(screen.getByRole('button')).not.toHaveClass('my-6');
  });

  it('denied keeps the circle but is inert, crossed and disabled', () => {
    const onHoldStart = vi.fn();
    const { container } = render(
      <MicButton state="denied" onHoldStart={onHoldStart} aria-label="Микрофон недоступен" />,
    );
    const button = screen.getByRole('button', { name: 'Микрофон недоступен' });
    expect(button).toBeDisabled();
    // still the circle, only muted: .wa-mic keeps size/radius, [data-state] swaps fill
    expect(button).toHaveClass('wa-mic');
    expect(button).toHaveAttribute('data-state', 'denied');
    expect(container.querySelector('path[d="M4 4l16 16"]')).not.toBeNull();

    fireEvent.pointerDown(button, { pointerId: 1 });
    expect(onHoldStart).not.toHaveBeenCalled();
  });

  it('is the .wa-mic circle inside the .wa-mic-wrap ring frame', () => {
    // The filled accent circle is .wa-mic itself (size, radius, fill and shelf
    // all hang off that one class) — losing it is the "floating glyph + bar"
    // regression, so the class and the wrapper it centres in are pinned here.
    const { container } = render(<MicButton state="idle" aria-label="speak" />);
    const wrap = container.querySelector('.wa-mic-wrap');
    const button = screen.getByRole('button');
    expect(wrap).not.toBeNull();
    expect(button).toHaveClass('wa-mic');
    expect(button).toHaveAttribute('data-state', 'idle');
    expect(wrap?.contains(button)).toBe(true);
  });
});
