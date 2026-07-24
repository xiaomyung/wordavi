import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { jitterDeg, StreakStamps } from '@/components/StreakStamps';

describe('jitterDeg', () => {
  it('is deterministic: the same seed always produces the same angle', () => {
    expect(jitterDeg('2026-07-20')).toBe(jitterDeg('2026-07-20'));
    expect(jitterDeg('day-3')).toBe(jitterDeg('day-3'));
  });

  it('stays within the +/-10deg jitter range', () => {
    for (const seed of ['a', 'b', 'c', 'day-0', 'day-1', '2026-01-01', '']) {
      const angle = jitterDeg(seed);
      expect(angle).toBeGreaterThanOrEqual(-10);
      expect(angle).toBeLessThanOrEqual(10);
    }
  });

  it('gives different keys different angles (no universal collision)', () => {
    expect(jitterDeg('day-1')).not.toBe(jitterDeg('day-2'));
  });
});

describe('StreakStamps', () => {
  it('renders one stamp per day and marks state via data-state', () => {
    const { container } = render(
      <StreakStamps
        days={[
          { seedKey: 'd0', state: 'done' },
          { seedKey: 'd1', state: 'today' },
          { seedKey: 'd2', state: 'future' },
        ]}
      />,
    );
    const stamps = container.querySelectorAll('[data-state]');
    expect(stamps).toHaveLength(3);
    expect(stamps[0]).toHaveAttribute('data-state', 'done');
    expect(stamps[0]).toHaveClass('border-correct');
    expect(stamps[1]).toHaveAttribute('data-state', 'today');
    expect(stamps[1]).toHaveClass('border-dashed');
    expect(stamps[2]).toHaveAttribute('data-state', 'future');
  });

  it('renders the same rotation for a done stamp across two mounts of the same seed', () => {
    const days = [{ seedKey: 'day-4', state: 'done' as const }];
    const first = render(<StreakStamps days={days} />);
    const firstStyle = (first.container.querySelector('[data-state]') as HTMLElement).style
      .transform;
    first.unmount();

    const second = render(<StreakStamps days={days} />);
    const secondStyle = (second.container.querySelector('[data-state]') as HTMLElement).style
      .transform;

    expect(firstStyle).toBe(secondStyle);
  });

  it('falls back to the --size-streak-stamp token (28px) when no size is given', () => {
    const { container } = render(<StreakStamps days={[{ seedKey: 'a', state: 'future' }]} />);
    const stamp = container.querySelector('[data-state]') as HTMLElement;
    expect(stamp.style.width).toBe('var(--size-streak-stamp)');
    expect(stamp.style.height).toBe('var(--size-streak-stamp)');
  });

  it('applies an explicit size override in px', () => {
    const { container } = render(
      <StreakStamps days={[{ seedKey: 'a', state: 'future' }]} size={30} />,
    );
    const stamp = container.querySelector('[data-state]') as HTMLElement;
    expect(stamp.style.width).toBe('30px');
  });

  it('pops the stamp at popIndex', () => {
    const { container } = render(
      <StreakStamps
        days={[
          { seedKey: 'a', state: 'done' },
          { seedKey: 'b', state: 'done' },
        ]}
        popIndex={1}
      />,
    );
    const stamps = container.querySelectorAll('[data-state]');
    expect(stamps[0]).not.toHaveClass('wa-stamp-pop');
    expect(stamps[1]).toHaveClass('wa-stamp-pop');
  });
});
