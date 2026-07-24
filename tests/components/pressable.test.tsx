import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Pressable } from '@/components/Pressable';

describe('Pressable', () => {
  it('renders a button carrying its children', () => {
    render(<Pressable>Press me</Pressable>);
    expect(screen.getByRole('button', { name: 'Press me' })).toBeInTheDocument();
  });

  it('defaults to type="button" and honours an explicit type', () => {
    const { rerender } = render(<Pressable>Go</Pressable>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    rerender(<Pressable type="submit">Go</Pressable>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('fires onClick when activated', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Pressable onClick={onClick}>Tap</Pressable>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('activates via keyboard (Enter and Space)', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Pressable onClick={onClick}>Key</Pressable>);
    screen.getByRole('button').focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('blocks clicks when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Pressable disabled onClick={onClick}>
        Nope
      </Pressable>,
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('reflects aria-disabled while staying focusable', () => {
    render(<Pressable aria-disabled>Inert</Pressable>);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    button.focus();
    expect(button).toHaveFocus();
  });

  it('forwards ref and merges className', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Pressable ref={ref} className="custom-x">
        Ref
      </Pressable>,
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toHaveClass('custom-x');
  });
});
