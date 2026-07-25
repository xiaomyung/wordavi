import type { ComponentPropsWithRef, CSSProperties } from 'react';
import './animations.css';
import { cx } from './cx';

/**
 * StreakStamps — loyalty-card streak row. See
 * design-handoff/wordavi-design-v1/components/streak-stamps.md.
 *
 * Jitter hash: each `done` stamp rotates by a value in [-10deg, 10deg] derived
 * from its `seedKey` via a plain FNV-1a-style string hash — same key always
 * produces the same angle (no `Math.random`, so re-renders and repeated
 * mounts with the same data are visually stable). `jitterDeg` is exported
 * standalone for that determinism to be unit-tested directly.
 */
export type StreakStampState = 'done' | 'today' | 'future';

export interface StreakStampDay {
  seedKey: string;
  state: StreakStampState;
}

export interface StreakStampsProps extends ComponentPropsWithRef<'div'> {
  days: readonly StreakStampDay[];
  /** Stamp diameter in px. Defaults to the --size-streak-stamp token (28px); stats.html uses 30. */
  size?: number;
  /** Index of the day whose stamp should play the 420ms pop-in (summary sequencing). */
  popIndex?: number;
}

export function jitterDeg(seedKey: string): number {
  let hash = 0;
  for (let i = 0; i < seedKey.length; i += 1) {
    hash = (Math.imul(hash, 31) + seedKey.charCodeAt(i)) | 0;
  }
  const normalized = (hash >>> 0) / 0xffffffff; // 0..1, deterministic
  return normalized * 20 - 10; // -10..10
}

const CHECK_PATH = 'M4 12.5l5.5 5.5L20 7';

function CheckGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={CHECK_PATH} />
    </svg>
  );
}

export function StreakStamps({ days, size, popIndex, className, ref, ...rest }: StreakStampsProps) {
  const dimension = size !== undefined ? `${size}px` : 'var(--size-streak-stamp)';

  return (
    <div ref={ref} className={cx('flex items-center gap-(--spacing-streak)', className)} {...rest}>
      {days.map((day, index) => {
        const rotate = day.state === 'done' ? jitterDeg(day.seedKey) : 0;
        // csstype's CSSProperties has no index signature for custom
        // properties, so the `--wa-stamp-rotate` hook for animations.css is
        // built as a plain record and cast at the call site.
        const style = {
          width: dimension,
          height: dimension,
          '--wa-stamp-rotate': `${rotate}deg`,
          transform: `rotate(${rotate}deg)`,
        } as CSSProperties;

        return (
          <span
            key={day.seedKey}
            data-state={day.state}
            style={style}
            className={cx(
              'flex shrink-0 items-center justify-center rounded-full',
              day.state === 'done' && 'border-2 border-correct bg-correct-tint text-correct',
              day.state === 'today' && 'border-2 border-dashed border-accent',
              day.state === 'future' && 'border-(length:--stroke-hairline) border-border',
              index === popIndex && 'wa-stamp-pop',
            )}
          >
            {day.state === 'done' ? <CheckGlyph /> : null}
          </span>
        );
      })}
    </div>
  );
}
