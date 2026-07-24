import type { ComponentPropsWithRef, ReactNode, TransitionEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { cx } from './cx';

/**
 * GoalRing — daily-goal ring. See
 * design-handoff/wordavi-design-v1/components/progress.md and motion.md.
 *
 * Arc math: a circle of `radius` has circumference `C = 2πr`. The filled arc
 * length for `value/max` is `C * clamp(value/max, 0, 1)`. Setting
 * `stroke-dasharray="filled C"` on a circle drawn from 12 o'clock
 * (`rotate(-90 cx cy)`, matching the home/summary mockups) draws exactly that
 * fraction of the ring with a hard stop — no dashoffset arithmetic needed.
 * `goalRingArc` is exported standalone so the 0/50/100% cases are unit-testable
 * without mounting the component.
 */
export type GoalRingSize = 'sm' | 'lg';

// Diameters come from the visual truth screens (not the loose "sm/lg" prose
// in the brief): home.html's dashboard ring is 56px, summary.html's result
// ring is 72px.
const SIZE_PX: Record<GoalRingSize, number> = {
  sm: 56,
  lg: 72,
};

const VIEWBOX = 36;
const CENTER = VIEWBOX / 2;
const RADIUS = 15;

// Belt-and-suspenders fallback for onSweepEnd: under prefers-reduced-motion,
// global.css forces transition-property to opacity-only, so our
// stroke-dasharray transition never fires and never emits `transitionend`.
// This timer guarantees the day-stamp sequencing callback still runs.
const SWEEP_FALLBACK_MS = 650;

export interface GoalRingArc {
  circumference: number;
  filled: number;
  dasharray: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function goalRingArc(value: number, max: number, radius: number = RADIUS): GoalRingArc {
  const circumference = 2 * Math.PI * radius;
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const filled = circumference * fraction;
  return {
    circumference: round2(circumference),
    filled: round2(filled),
    dasharray: `${round2(filled)} ${round2(circumference)}`,
  };
}

export interface GoalRingProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  value: number;
  max: number;
  size?: GoalRingSize;
  /** Animate the arc from 0 to `value` over 600ms ease-in-out. */
  sweep?: boolean;
  onSweepEnd?: () => void;
  children?: ReactNode;
}

export function GoalRing({
  value,
  max,
  size = 'sm',
  sweep = false,
  onSweepEnd,
  children,
  className,
  ref,
  ...rest
}: GoalRingProps) {
  const [displayValue, setDisplayValue] = useState(sweep ? 0 : value);
  const firedRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: onSweepEnd is an event handler, not a dependency the sweep should restart on
  useEffect(() => {
    if (!sweep) {
      setDisplayValue(value);
      return;
    }

    firedRef.current = false;
    setDisplayValue(0);
    const raf = requestAnimationFrame(() => setDisplayValue(value));
    const timer = window.setTimeout(() => {
      if (firedRef.current) return;
      firedRef.current = true;
      onSweepEnd?.();
    }, SWEEP_FALLBACK_MS);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [sweep, value]);

  const diameter = SIZE_PX[size];
  const arc = goalRingArc(displayValue, max);
  // The label reports the real `value`, not the swept `displayValue`: mid-sweep
  // the arc is still travelling, but a screen reader must never be told the
  // goal is 0%. Clamped the same way the arc is, so 25/20 reads "100%".
  const percentLabel = Math.round((max > 0 ? Math.min(1, Math.max(0, value / max)) : 0) * 100);

  function handleTransitionEnd(event: TransitionEvent<SVGCircleElement>) {
    if (event.propertyName !== 'stroke-dasharray' || firedRef.current) return;
    firedRef.current = true;
    onSweepEnd?.();
  }

  return (
    <div
      ref={ref}
      className={cx('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: diameter, height: diameter }}
      {...rest}
    >
      <svg
        width={diameter}
        height={diameter}
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        role="img"
        aria-label={`${percentLabel}%`}
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          className="stroke-surface-well"
          style={{ strokeWidth: 'var(--stroke-ring)' }}
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          className="stroke-correct transition-[stroke-dasharray] duration-(--duration-ring) ease-in-out"
          style={{ strokeWidth: 'var(--stroke-ring)' }}
          strokeLinecap="round"
          strokeDasharray={arc.dasharray}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          onTransitionEnd={handleTransitionEnd}
        />
      </svg>
      {children ? (
        <span className="absolute inset-0 flex items-center justify-center">{children}</span>
      ) : null}
    </div>
  );
}
