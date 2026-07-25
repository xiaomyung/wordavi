import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressRule } from '@/components/ProgressRule';

describe('ProgressRule', () => {
  it('renders the track at 4px tall with the well/accent colors', () => {
    render(<ProgressRule value={7} max={30} />);
    const track = screen.getByRole('progressbar');
    expect(track).toHaveClass('h-1');
    expect(track).toHaveClass('bg-surface-well');
    expect(track.firstElementChild).toHaveClass('bg-accent');
  });

  it('sets width from value/max and clamps to [0, 100]', () => {
    render(<ProgressRule value={15} max={30} />);
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '50%' });
  });

  it('animates forward with the swap-duration transition when value increases', () => {
    const { rerender } = render(<ProgressRule value={5} max={10} />);
    rerender(<ProgressRule value={8} max={10} />);
    const fill = screen.getByRole('progressbar').firstElementChild;
    expect(fill).toHaveClass('duration-(--duration-swap)');
    expect(fill).not.toHaveClass('duration-0');
  });

  it('jumps instantly with no transition when value drops (new round)', () => {
    const { rerender } = render(<ProgressRule value={9} max={10} />);
    rerender(<ProgressRule value={1} max={10} />);
    const fill = screen.getByRole('progressbar').firstElementChild;
    expect(fill).toHaveClass('duration-0');
    expect(fill).toHaveStyle({ width: '10%' });
  });
});
