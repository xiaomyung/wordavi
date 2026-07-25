import type { ComponentPropsWithRef } from 'react';
import { useEffect, useRef, useState } from 'react';
import { cx } from './cx';

/**
 * ProgressRule — round progress bar. See
 * design-handoff/wordavi-design-v1/components/progress.md.
 *
 * Width animates forward only: when `value` rises the fill grows over
 * `--duration-swap` (240ms ease-out, shared with the question-swap motion);
 * when it drops — a new round starting over — the fill jumps instantly with
 * no animation.
 */
export interface ProgressRuleProps extends ComponentPropsWithRef<'div'> {
  value: number;
  max?: number;
}

function percentOf(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

export function ProgressRule({ value, max = 100, className, ref, ...rest }: ProgressRuleProps) {
  const percent = percentOf(value, max);
  const previousPercent = useRef(percent);
  const [instant, setInstant] = useState(false);

  useEffect(() => {
    const wentBackwards = percent < previousPercent.current;
    previousPercent.current = percent;
    if (!wentBackwards) return;

    // Jump instantly for a new round: disable the transition for one paint,
    // then restore it so the next forward advance animates again.
    setInstant(true);
    const raf = requestAnimationFrame(() => setInstant(false));
    return () => cancelAnimationFrame(raf);
  }, [percent]);

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cx('h-1 w-full overflow-hidden rounded-progress bg-surface-well', className)}
      {...rest}
    >
      <div
        className={cx(
          'h-full rounded-progress bg-accent ease-out',
          instant ? 'duration-0' : 'duration-(--duration-swap)',
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
