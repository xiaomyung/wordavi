import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from './cx';

/**
 * SkillBar — one stats-screen skill rule. See
 * design-handoff/wordavi-design-v1/components/progress.md and
 * design-handoff/wordavi-design-v1/screens/stats.html `.bar`.
 *
 * The caller decides `warn` (accuracy < 60%) and supplies the paired "needs
 * practice" flag chip — color is never the only signal (a11y.md).
 */
export interface SkillBarProps extends ComponentPropsWithRef<'div'> {
  label: ReactNode;
  percent: number;
  warn?: boolean;
  flag?: ReactNode;
}

export function SkillBar({
  label,
  percent,
  warn = false,
  flag,
  className,
  ref,
  ...rest
}: SkillBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div ref={ref} className={cx('flex flex-col gap-1', className)} {...rest}>
      <div className="flex items-center justify-between text-[13.5px]">
        <span className="font-bold">
          {label}
          {flag}
        </span>
        <span className="font-bold tabular-nums text-text-muted">{Math.round(clamped)}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={typeof label === 'string' ? label : undefined}
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 overflow-hidden rounded-track bg-surface-well"
      >
        <div
          className={cx('h-full', warn ? 'bg-almost' : 'bg-correct')}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
