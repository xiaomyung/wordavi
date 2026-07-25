import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import './animations.css';
import { cx } from './cx';

/**
 * Chip — quiet pill badges. See design-handoff/wordavi-design-v1/components/badges.md.
 * Chips carry no shadow and no animation except the combo tick (motion.md).
 */
export type ChipVariant = 'score' | 'combo' | 'offline' | 'flag' | 'replay';

export interface ChipProps extends ComponentPropsWithRef<'span'> {
  variant: ChipVariant;
  icon?: ReactNode;
  /**
   * Any value that changes whenever the chip's displayed count should pulse
   * (e.g. the combo counter). Comparing this on every render — rather than
   * exposing an imperative "play()" — keeps the component a pure function of
   * props, matching the rest of this presentational layer.
   */
  tick?: string | number;
  children?: ReactNode;
}

// Each variant pins its own font-size token rather than sharing one base
// class, since Tailwind's cascade order (not class-attribute order) would
// otherwise decide which of two same-specificity font-size utilities wins.
const VARIANT_CLASS: Record<ChipVariant, string> = {
  score: 'bg-surface-sunken text-overline font-extrabold text-text',
  combo: 'bg-correct-tint border border-correct text-overline font-extrabold text-correct-text',
  offline: 'bg-surface-sunken text-overline font-extrabold text-text-muted',
  flag: 'bg-almost-tint border border-almost text-flag font-extrabold text-almost-text',
  replay: 'bg-surface-raised border border-border text-caption font-bold text-text-muted',
};

export function Chip({ variant, icon, tick, children, className, ref, ...rest }: ChipProps) {
  const previousTick = useRef(tick);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    if (previousTick.current !== undefined && previousTick.current !== tick) {
      setPulseKey((key) => key + 1);
    }
    previousTick.current = tick;
  }, [tick]);

  return (
    <span
      ref={ref}
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-1 tabular-nums',
        VARIANT_CLASS[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      <span key={pulseKey} className={pulseKey > 0 ? 'wa-chip-tick' : undefined}>
        {children}
      </span>
    </span>
  );
}
