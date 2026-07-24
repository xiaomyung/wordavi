import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Card, CardRow } from '@/components/Card';

describe('Card', () => {
  it('renders the raised variant by default with shelf styling', () => {
    render(<Card data-testid="card">content</Card>);
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('bg-surface-raised');
    expect(card).toHaveClass('shadow-shelf-raised');
    expect(card).toHaveClass('rounded-card');
  });

  it('renders the grouped variant with zero padding and hairline dividers', () => {
    render(<Card variant="grouped" data-testid="card" />);
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('divide-y');
    expect(card).toHaveClass('divide-surface-sunken');
    expect(card).not.toHaveClass('p-4');
  });

  it('renders the float variant with shadow-float instead of the shelf', () => {
    render(<Card variant="float" data-testid="card" />);
    expect(screen.getByTestId('card')).toHaveClass('shadow-float');
  });

  it('renders the paused variant dashed and dimmed', () => {
    render(<Card variant="paused" data-testid="card" />);
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('border-dashed');
    expect(card).toHaveClass('bg-surface-paused');
  });

  it.each(['raised', 'float', 'paused'] as const)(
    'stacks %s children as separate lines',
    (variant) => {
      // Without the column stack the children are inline spans and run
      // together ("Скажите вслухвернётся с интернетом"); `grouped` is exempt
      // because CardRow owns its own layout.
      render(<Card variant={variant} data-testid="card" />);
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('flex');
      expect(card).toHaveClass('flex-col');
      expect(card).toHaveClass('gap-3');
    },
  );

  it('passes through className alongside variant classes', () => {
    render(<Card className="custom" data-testid="card" />);
    expect(screen.getByTestId('card')).toHaveClass('custom');
  });
});

describe('CardRow', () => {
  it('renders as a plain row with label and sub when there is no onPress', () => {
    render(<CardRow label="Sound" sub="on by default" />);
    expect(screen.getByText('Sound')).toBeInTheDocument();
    expect(screen.getByText('on by default')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders as a real button and fires onPress when tappable', async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(<CardRow label="Manage subscription" onPress={onPress} />);

    const row = screen.getByRole('button', { name: /manage subscription/i });
    await user.click(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders trailing content', () => {
    render(<CardRow label="Streak" trailing={<span>7</span>} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });
});
