import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from './cx';

/**
 * ModeRow — home-screen mode list row. See
 * design-handoff/wordavi-design-v1/screens/home.html `.mrow` for visual truth.
 *
 * The whole row is a button (>= 64px touch target). `paused` renders the
 * dashed/dimmed offline style; per the home.html mockup a paused row never
 * shows a chevron — it always carries a trailing chip (e.g. an "offline" Chip)
 * instead, so `trailing` fully replaces the chevron whenever it is supplied.
 */
export interface ModeRowProps extends Omit<ComponentPropsWithRef<'button'>, 'onClick' | 'title'> {
  icon: ReactNode;
  title: ReactNode;
  sub: ReactNode;
  trailing?: ReactNode;
  paused?: boolean;
  onPress?: () => void;
}

const CHEVRON_PATH = 'M9 5l7 7-7 7';

function RowChevron() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-text-faint"
    >
      <path d={CHEVRON_PATH} />
    </svg>
  );
}

export function ModeRow({
  icon,
  title,
  sub,
  trailing,
  paused = false,
  onPress,
  className,
  ref,
  ...rest
}: ModeRowProps) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onPress}
      className={cx(
        'flex min-h-(--size-choice) w-full items-center gap-3.5 rounded-button px-3.5 py-3 text-left',
        paused
          ? 'border border-dashed border-border-strong bg-surface-paused'
          : 'border border-border bg-surface-raised shadow-shelf-raised',
        className,
      )}
      {...rest}
    >
      <span
        className={cx(
          'flex size-11 shrink-0 items-center justify-center rounded-key bg-surface-sunken font-display text-xl font-bold text-accent',
          paused && 'opacity-65',
        )}
      >
        {icon}
      </span>
      <span className="flex flex-1 flex-col gap-px overflow-hidden">
        <span
          className={cx('text-[15.5px] font-extrabold', paused ? 'text-text-muted' : 'text-text')}
        >
          {title}
        </span>
        <span
          className={cx(
            'truncate text-caption font-semibold',
            paused ? 'text-text-faint' : 'text-text-muted',
          )}
        >
          {sub}
        </span>
      </span>
      {trailing ?? (paused ? null : <RowChevron />)}
    </button>
  );
}
