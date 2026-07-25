import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';

/**
 * Dots — onboarding step progress. See
 * design-handoff/wordavi-design-v1/screens/onboarding.html `.dots`.
 * The active dot widens into a pill; the swap reuses --duration-swap (240ms),
 * the same "advance" timing as ProgressRule/question-swap motion.
 */
export interface DotsProps extends ComponentPropsWithRef<'div'> {
  count: number;
  activeIndex: number;
}

export function Dots({ count, activeIndex, className, ref, ...rest }: DotsProps) {
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={activeIndex + 1}
      aria-valuemin={1}
      aria-valuemax={count}
      className={cx('flex items-center justify-center gap-1.5', className)}
      {...rest}
    >
      {Array.from({ length: count }, (_, index) => {
        const active = index === activeIndex;
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length positional dots have no other identity
            key={index}
            aria-hidden="true"
            className={cx(
              'h-1.5 rounded-pill transition-[width] duration-(--duration-swap) ease-out',
              active ? 'w-5.5 bg-accent' : 'w-1.5 bg-border-strong',
            )}
          />
        );
      })}
    </div>
  );
}
