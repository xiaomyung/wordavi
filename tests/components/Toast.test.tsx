import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Toast, Toaster } from '@/components/Toast';

describe('Toast', () => {
  it('announces itself as a polite status region', () => {
    render(<Toast open text="Saved" />);
    const toast = screen.getByRole('status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
    expect(toast).toHaveTextContent('Saved');
  });

  it('is visible when open and hidden (faded, risen) when closed', () => {
    const { rerender } = render(<Toast open text="Offline" />);
    expect(screen.getByRole('status')).toHaveClass('opacity-100');

    rerender(<Toast open={false} text="Offline" />);
    expect(screen.getByRole('status')).toHaveClass('opacity-0');
  });

  it('fires the action and shows its label as a >=44px hit target', async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(<Toast open text="4 missed" action={{ label: 'Retry', onPress }} />);

    const action = screen.getByRole('button', { name: 'Retry' });
    expect(action).toHaveClass('min-h-touch');
    await user.click(action);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders no action button when none is supplied', () => {
    render(<Toast open text="Saved" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Toaster', () => {
  it('renders every item in the list as its own status toast', () => {
    render(
      <Toaster
        items={[
          { id: 'a', text: 'First' },
          { id: 'b', text: 'Second' },
        ]}
      />,
    );
    const toasts = screen.getAllByRole('status');
    expect(toasts).toHaveLength(2);
    expect(toasts[0]).toHaveTextContent('First');
    expect(toasts[1]).toHaveTextContent('Second');
  });

  it('defaults each item to open', () => {
    render(<Toaster items={[{ id: 'a', text: 'Hi' }]} />);
    expect(screen.getByRole('status')).toHaveClass('opacity-100');
  });
});
