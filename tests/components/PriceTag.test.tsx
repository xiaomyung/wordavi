import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { computePriceTagFontSizePx, PriceTag } from '@/components/PriceTag';

describe('computePriceTagFontSizePx', () => {
  it('uses the full prompt-lg size for short prices', () => {
    expect(computePriceTagFontSizePx('2,35 €')).toBe(56);
  });

  it('shrinks as the content gets longer', () => {
    const short = computePriceTagFontSizePx('2,35 €');
    const long = computePriceTagFontSizePx('dos kilos y medio');
    expect(long).toBeLessThan(short);
  });

  it('never shrinks below the readable floor', () => {
    const veryLong = computePriceTagFontSizePx('a'.repeat(80));
    expect(veryLong).toBeGreaterThanOrEqual(22);
  });

  it('is monotonically non-increasing with length', () => {
    const sizes = ['1 €', '12 €', '123 €', '1234 €', '12345 €'].map(computePriceTagFontSizePx);
    for (let i = 1; i < sizes.length; i += 1) {
      expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1] as number);
    }
  });
});

describe('PriceTag', () => {
  it('renders the price as its content with the punch hole and rotation classes', () => {
    render(<PriceTag>2,35 €</PriceTag>);
    const text = screen.getByText('2,35 €');
    expect(text).toBeInTheDocument();
    expect(text.parentElement).toHaveClass('-rotate-1');
    expect(text.parentElement).toHaveClass('shadow-shelf-raised');
  });

  it('applies the computed font size inline so any content fits one line', () => {
    render(<PriceTag>dos kilos y medio</PriceTag>);
    const text = screen.getByText('dos kilos y medio');
    expect(text.style.fontSize).toBe(`${computePriceTagFontSizePx('dos kilos y medio')}px`);
  });
});
