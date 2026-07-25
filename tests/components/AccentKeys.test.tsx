import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AccentKeys } from '@/components/AccentKeys';

const CHARS = ['á', 'é', 'í', 'ó', 'ú', 'ñ'];

describe('AccentKeys', () => {
  it('renders the six diacritic keys as buttons', () => {
    render(<AccentKeys onInsert={vi.fn()} label="Accents" />);
    const group = screen.getByRole('group', { name: 'Accents' });
    const keys = within(group).getAllByRole('button');
    expect(keys.map((key) => key.textContent)).toEqual(CHARS);
    for (const key of keys) expect(key).toHaveAttribute('type', 'button');
  });

  it('calls onInsert with the pressed character', async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    render(<AccentKeys onInsert={onInsert} />);
    await user.click(screen.getByRole('button', { name: 'ñ' }));
    expect(onInsert).toHaveBeenCalledWith('ñ');
  });

  it('prevents default on mousedown so the field keeps focus', () => {
    render(<AccentKeys onInsert={vi.fn()} />);
    const notCancelled = fireEvent.mouseDown(screen.getByRole('button', { name: 'á' }));
    // fireEvent returns false when preventDefault was called on a cancelable event
    expect(notCancelled).toBe(false);
  });

  it('keeps keys in the tab order', () => {
    render(<AccentKeys onInsert={vi.fn()} />);
    const key = screen.getByRole('button', { name: 'é' });
    expect(key).not.toHaveAttribute('tabindex', '-1');
    key.focus();
    expect(key).toHaveFocus();
  });

  it('disables every key when disabled', async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    render(<AccentKeys onInsert={onInsert} disabled />);
    const keys = screen.getAllByRole('button');
    for (const key of keys) expect(key).toBeDisabled();
    await user.click(keys[0] as HTMLElement);
    expect(onInsert).not.toHaveBeenCalled();
  });
});
