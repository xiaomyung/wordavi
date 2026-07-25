import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChoiceButton } from '@/components/ChoiceButton';

describe('ChoiceButton', () => {
  it('renders the numeral label as an interactive button when idle', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ChoiceButton state="idle" onClick={onClick}>
        veinte
      </ChoiceButton>,
    );
    const button = screen.getByRole('button', { name: 'veinte' });
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('marks the selected state with aria-pressed', () => {
    render(<ChoiceButton state="selected">treinta</ChoiceButton>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a check stamp and becomes inert when revealed correct', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { container } = render(
      <ChoiceButton state="revealedCorrect" onClick={onClick}>
        cuarenta
      </ChoiceButton>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(container.querySelector('svg')).toBeInTheDocument();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows a cross stamp and ignores clicks when chosen wrong', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { container } = render(
      <ChoiceButton state="chosenWrong" onClick={onClick}>
        cincuenta
      </ChoiceButton>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
    expect(container.querySelector('svg')).toBeInTheDocument();
    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('locks idle tiles after reveal without dimming them', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ChoiceButton state="idle" locked onClick={onClick}>
        sesenta
      </ChoiceButton>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    // idle appearance retained (not the flat selected/revealed fill)
    expect(button).toHaveClass('bg-surface-raised');
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders no stamp in idle or selected states', () => {
    const { container, rerender } = render(<ChoiceButton state="idle">10</ChoiceButton>);
    expect(container.querySelector('svg')).toBeNull();
    rerender(<ChoiceButton state="selected">10</ChoiceButton>);
    expect(container.querySelector('svg')).toBeNull();
  });
});
