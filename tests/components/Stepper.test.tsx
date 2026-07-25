import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Stepper } from '@/components/Stepper';

describe('Stepper', () => {
  it('renders the value and labelled controls', () => {
    render(
      <Stepper
        onDecrement={vi.fn()}
        onIncrement={vi.fn()}
        aria-label="Questions per round"
        decrementLabel="Fewer"
        incrementLabel="More"
      >
        30
      </Stepper>,
    );
    expect(screen.getByRole('group', { name: 'Questions per round' })).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fewer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('calls the step callbacks', async () => {
    const user = userEvent.setup();
    const onDecrement = vi.fn();
    const onIncrement = vi.fn();
    render(
      <Stepper
        onDecrement={onDecrement}
        onIncrement={onIncrement}
        decrementLabel="Fewer"
        incrementLabel="More"
      >
        30
      </Stepper>,
    );
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(screen.getByRole('button', { name: 'Fewer' }));
    expect(onIncrement).toHaveBeenCalledTimes(1);
    expect(onDecrement).toHaveBeenCalledTimes(1);
  });

  it('disables and blocks the boundary controls', async () => {
    const user = userEvent.setup();
    const onDecrement = vi.fn();
    const onIncrement = vi.fn();
    render(
      <Stepper
        onDecrement={onDecrement}
        onIncrement={onIncrement}
        canDecrement={false}
        canIncrement={false}
        decrementLabel="Fewer"
        incrementLabel="More"
      >
        5
      </Stepper>,
    );
    const fewer = screen.getByRole('button', { name: 'Fewer' });
    const more = screen.getByRole('button', { name: 'More' });
    expect(fewer).toBeDisabled();
    expect(more).toBeDisabled();
    await user.click(fewer);
    await user.click(more);
    expect(onDecrement).not.toHaveBeenCalled();
    expect(onIncrement).not.toHaveBeenCalled();
  });

  it('renders a non-numeric value in an aria-live region', () => {
    render(
      <Stepper onDecrement={vi.fn()} onIncrement={vi.fn()}>
        ∞
      </Stepper>,
    );
    const value = screen.getByText('∞');
    expect(value).toHaveAttribute('aria-live', 'polite');
  });
});
