import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PillButton } from '@/components/PillButton';

describe('PillButton', () => {
  it('reflects the active toggle state', () => {
    const off = render(<PillButton active={false}>медленнее ×0,75</PillButton>);
    const offButton = screen.getByRole('button', { name: 'медленнее ×0,75' });
    expect(offButton).not.toHaveAttribute('data-active');
    expect(offButton).toHaveAttribute('aria-pressed', 'false');
    off.unmount();

    render(<PillButton active>медленнее ×0,75</PillButton>);
    const onButton = screen.getByRole('button', { name: 'медленнее ×0,75' });
    expect(onButton).toHaveAttribute('data-active', 'true');
    expect(onButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('omits aria-pressed for a plain action chip', () => {
    // The replay chip is an action, not a toggle — announcing it as an
    // unpressed toggle would be a lie (speaker-button.md).
    render(<PillButton>прослушать</PillButton>);
    expect(screen.getByRole('button', { name: 'прослушать' })).not.toHaveAttribute('aria-pressed');
  });

  it('passes className through and defaults to type=button', () => {
    render(<PillButton className="mt-4">офлайн</PillButton>);
    const button = screen.getByRole('button', { name: 'офлайн' });
    expect(button).toHaveClass('wa-pill', 'mt-4');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('renders a leading glyph with its label and forwards clicks', () => {
    const onClick = vi.fn();
    render(
      <PillButton glyph={<span data-testid="glyph">♪</span>} onClick={onClick}>
        прослушать
      </PillButton>,
    );
    const button = screen.getByRole('button', { name: /прослушать/ });
    expect(button.querySelector('[data-testid="glyph"]')).not.toBeNull();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
