import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Stamp } from '@/components/Stamp';

describe('Stamp', () => {
  it('draws the correct (check) variant, decorative and coloured', () => {
    const { container } = render(<Stamp verdict="correct" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-verdict', 'correct');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveClass('wa-stamp', 'wa-stamp--correct');
    // ring + single check path
    expect(container.querySelectorAll('path')).toHaveLength(1);
  });

  it('draws the almost (tilde-equals) variant with two tilde strokes', () => {
    const { container } = render(<Stamp verdict="almost" />);
    expect(container.querySelector('svg')).toHaveAttribute('data-verdict', 'almost');
    expect(container.querySelector('svg')).toHaveClass('wa-stamp--almost');
    expect(container.querySelectorAll('path')).toHaveLength(2);
  });

  it('draws the wrong (cross) variant', () => {
    const { container } = render(<Stamp verdict="wrong" />);
    expect(container.querySelector('svg')).toHaveAttribute('data-verdict', 'wrong');
    expect(container.querySelector('svg')).toHaveClass('wa-stamp--wrong');
  });

  it('only marks data-animate when animate is set', () => {
    const still = render(<Stamp verdict="correct" />);
    expect(still.container.querySelector('svg')).not.toHaveAttribute('data-animate');

    const popped = render(<Stamp verdict="correct" animate />);
    expect(popped.container.querySelector('svg')).toHaveAttribute('data-animate', 'true');
  });

  it('honours the size prop (26 default, 22 inline)', () => {
    const dflt = render(<Stamp verdict="wrong" />);
    expect(dflt.container.querySelector('svg')).toHaveAttribute('width', '26');

    const small = render(<Stamp verdict="wrong" size={22} />);
    expect(small.container.querySelector('svg')).toHaveAttribute('width', '22');
    expect(small.container.querySelector('svg')).toHaveAttribute('height', '22');
  });
});
