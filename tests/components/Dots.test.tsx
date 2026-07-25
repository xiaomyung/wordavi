import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dots } from '@/components/Dots';

describe('Dots', () => {
  it('renders one dot per step and reports progress via ARIA', () => {
    const { container } = render(<Dots count={4} activeIndex={1} />);
    const track = screen.getByRole('progressbar');
    expect(track).toHaveAttribute('aria-valuenow', '2');
    expect(track).toHaveAttribute('aria-valuemax', '4');
    expect(container.querySelectorAll('span[aria-hidden]')).toHaveLength(4);
  });

  it('widens only the active dot into a pill', () => {
    const { container } = render(<Dots count={3} activeIndex={2} />);
    const dots = container.querySelectorAll('span[aria-hidden]');
    expect(dots[0]).toHaveClass('w-1.5');
    expect(dots[0]).not.toHaveClass('bg-accent');
    expect(dots[2]).toHaveClass('w-5.5');
    expect(dots[2]).toHaveClass('bg-accent');
  });
});
