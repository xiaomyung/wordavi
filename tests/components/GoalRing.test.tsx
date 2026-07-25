import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoalRing, goalRingArc } from '@/components/GoalRing';

describe('goalRingArc', () => {
  it('draws an empty arc at 0%', () => {
    const arc = goalRingArc(0, 20, 15);
    expect(arc.filled).toBe(0);
    expect(arc.dasharray).toBe('0 94.25');
  });

  it('draws a half arc at 50%', () => {
    const arc = goalRingArc(10, 20, 15);
    expect(arc.filled).toBeCloseTo(47.12, 1);
    expect(arc.dasharray).toBe('47.12 94.25');
  });

  it('draws a full arc at 100%', () => {
    const arc = goalRingArc(20, 20, 15);
    expect(arc.filled).toBe(arc.circumference);
    expect(arc.dasharray).toBe('94.25 94.25');
  });

  it('clamps values above max to a full arc', () => {
    const arc = goalRingArc(999, 20, 15);
    expect(arc.filled).toBe(arc.circumference);
  });

  it('treats a zero/invalid max as empty rather than dividing by zero', () => {
    const arc = goalRingArc(5, 0, 15);
    expect(arc.filled).toBe(0);
  });
});

describe('GoalRing', () => {
  it('renders the arc for the current value without sweep', () => {
    const { container } = render(<GoalRing value={10} max={20} />);
    const arcCircle = container.querySelectorAll('circle')[1];
    expect(arcCircle).toHaveAttribute('stroke-dasharray', goalRingArc(10, 20).dasharray);
  });

  it('sizes the ring from the size prop', () => {
    const { container: small } = render(<GoalRing value={1} max={2} />);
    expect(small.querySelector('svg')).toHaveAttribute('width', '56');

    const { container: large } = render(<GoalRing value={1} max={2} size="lg" />);
    expect(large.querySelector('svg')).toHaveAttribute('width', '72');
  });

  it('labels the ring with the real percentage, clamped to 100', () => {
    const { container } = render(<GoalRing value={25} max={20} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-label', '100%');
  });

  it('renders center content', () => {
    render(
      <GoalRing value={10} max={20}>
        <span>50%</span>
      </GoalRing>,
    );
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  describe('sweep', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('starts from an empty arc and fires onSweepEnd once the fallback timer elapses', () => {
      const onSweepEnd = vi.fn();
      const { container } = render(<GoalRing value={10} max={20} sweep onSweepEnd={onSweepEnd} />);

      const arcCircle = container.querySelectorAll('circle')[1];
      expect(arcCircle).toHaveAttribute('stroke-dasharray', '0 94.25');
      expect(onSweepEnd).not.toHaveBeenCalled();

      act(() => {
        vi.runAllTimers();
      });
      expect(onSweepEnd).toHaveBeenCalledTimes(1);
    });

    it('announces the target percentage while the arc is still travelling', () => {
      const { container } = render(<GoalRing value={10} max={20} sweep />);
      expect(container.querySelectorAll('circle')[1]).toHaveAttribute(
        'stroke-dasharray',
        '0 94.25',
      );
      expect(container.querySelector('svg')).toHaveAttribute('aria-label', '50%');
    });
  });
});
