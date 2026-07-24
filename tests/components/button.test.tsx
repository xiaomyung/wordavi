import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/Button';

describe('Button', () => {
  it('renders each variant as a button with its label', () => {
    const { rerender } = render(<Button variant="primary">Check</Button>);
    expect(screen.getByRole('button', { name: 'Check' })).toBeInTheDocument();
    rerender(<Button variant="secondary">Skip</Button>);
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    rerender(<Button variant="ghost">See modes</Button>);
    expect(screen.getByRole('button', { name: 'See modes' })).toBeInTheDocument();
  });

  it('defaults to the primary variant', () => {
    render(<Button>Default</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-accent');
  });

  it('fires onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Next</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick while disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Wait
      </Button>,
    );
    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toHaveClass('disabled:bg-disabled-bg');
  });

  it('exposes an accessible name for the icon variant via aria-label', () => {
    render(
      <Button variant="icon" aria-label="Back">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('applies the tall size only to CTA variants', () => {
    const { rerender } = render(
      <Button variant="primary" size="tall">
        Start
      </Button>,
    );
    expect(screen.getByRole('button')).toHaveClass('h-(--size-cta-tall)');
    rerender(
      <Button variant="icon" size="tall" aria-label="X">
        x
      </Button>,
    );
    expect(screen.getByRole('button')).not.toHaveClass('h-(--size-cta-tall)');
  });
});
