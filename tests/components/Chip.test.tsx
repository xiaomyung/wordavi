import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Chip } from '@/components/Chip';

describe('Chip', () => {
  it('renders the score variant on a sunken pill', () => {
    render(<Chip variant="score">240 очков</Chip>);
    const chip = screen.getByText('240 очков');
    expect(chip.parentElement).toHaveClass('bg-surface-sunken');
  });

  it('renders the combo variant with the correct tint and border', () => {
    render(<Chip variant="combo">x3</Chip>);
    const chip = screen.getByText('x3').parentElement;
    expect(chip).toHaveClass('bg-correct-tint');
    expect(chip).toHaveClass('border-correct');
  });

  it('renders the flag variant at the 11px flag text size', () => {
    render(<Chip variant="flag">потренировать</Chip>);
    expect(screen.getByText('потренировать').parentElement).toHaveClass('text-flag');
  });

  it('renders the offline variant muted on a sunken pill', () => {
    render(<Chip variant="offline">офлайн</Chip>);
    const chip = screen.getByText('офлайн').parentElement;
    expect(chip).toHaveClass('bg-surface-sunken');
    expect(chip).toHaveClass('text-text-muted');
  });

  it('renders the replay variant as a bordered raised pill', () => {
    render(<Chip variant="replay">прослушать</Chip>);
    const chip = screen.getByText('прослушать').parentElement;
    expect(chip).toHaveClass('bg-surface-raised');
    expect(chip).toHaveClass('border-border');
  });

  it('renders a leading glyph slot before the label', () => {
    render(
      <Chip variant="offline" icon={<svg role="img" aria-label="wifi off" />}>
        офлайн
      </Chip>,
    );
    expect(screen.getByRole('img', { name: 'wifi off' })).toBeInTheDocument();
  });

  it('does not pulse on first render', () => {
    render(
      <Chip variant="combo" tick={3}>
        x3
      </Chip>,
    );
    expect(screen.getByText('x3')).not.toHaveClass('wa-chip-tick');
  });

  it('pulses when the tick value changes', () => {
    const { rerender } = render(
      <Chip variant="combo" tick={3}>
        x3
      </Chip>,
    );
    rerender(
      <Chip variant="combo" tick={4}>
        x4
      </Chip>,
    );
    expect(screen.getByText('x4')).toHaveClass('wa-chip-tick');
  });

  it('does not pulse when re-rendered with the same tick value', () => {
    const { rerender } = render(
      <Chip variant="combo" tick={3}>
        x3
      </Chip>,
    );
    rerender(
      <Chip variant="combo" tick={3}>
        x3
      </Chip>,
    );
    expect(screen.getByText('x3')).not.toHaveClass('wa-chip-tick');
  });
});
