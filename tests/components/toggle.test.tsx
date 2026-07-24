import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Toggle } from '@/components/Toggle';

describe('Toggle', () => {
  it('exposes a switch role reflecting checked state', () => {
    const { rerender } = render(<Toggle checked={false} onChange={vi.fn()} aria-label="Accents" />);
    const toggle = screen.getByRole('switch', { name: 'Accents' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    rerender(<Toggle checked onChange={vi.fn()} aria-label="Accents" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange with the toggled value on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} aria-label="Accents" />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('toggles from checked to unchecked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked onChange={onChange} aria-label="Accents" />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('toggles with the keyboard (Space)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} aria-label="Accents" />);
    screen.getByRole('switch').focus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not fire onChange when disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} disabled aria-label="Accents" />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeDisabled();
    await user.click(toggle);
    expect(onChange).not.toHaveBeenCalled();
  });
});
