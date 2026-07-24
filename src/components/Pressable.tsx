import type { ButtonHTMLAttributes, Ref } from 'react';
import { cx } from './cx';

/** 'primary' = 3px accent underside (--shadow-shelf); 'raised' = 2px shelf-line underside. */
export type ShelfDepth = 'primary' | 'raised';

/**
 * Press travel matches each shadow's underside offset (3px / 2px). No token
 * exists for shelf travel on its own — it lives inside the shadow definitions
 * (`0 3px 0` / `0 2px 0`) — so the distance is written as an arbitrary length.
 * Focus keeps the shelf shadow and layers the ring outside it (buttons.md).
 */
const SHELF: Record<ShelfDepth, { resting: string; press: string; focus: string }> = {
  primary: {
    resting: 'shadow-(--shadow-shelf)',
    press: 'active:translate-y-[3px]',
    focus: 'focus-visible:shadow-[var(--shadow-focus),var(--shadow-shelf)]',
  },
  raised: {
    resting: 'shadow-(--shadow-shelf-raised)',
    press: 'active:translate-y-[2px]',
    focus: 'focus-visible:shadow-[var(--shadow-focus),var(--shadow-shelf-raised)]',
  },
};

export interface PressableProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  depth?: ShelfDepth;
  /** Suppress resting shelf + press travel (selected/revealed tiles, ghost text buttons). */
  flat?: boolean;
  // explicit `| undefined`: callers forward a possibly-absent ref under exactOptionalPropertyTypes
  ref?: Ref<HTMLButtonElement> | undefined;
}

/**
 * Shared shelf-physics primitive: a <button> that sinks into its shadow on
 * press. Fill / size / radius / typography are supplied by callers via
 * className; this owns only the tactile behaviour, focus ring and disabled
 * treatment. `aria-disabled` marks a control inert (no press physics) while
 * keeping it focusable — the native `disabled` attribute drops it from the tab
 * order and removes the shadow entirely.
 */
export function Pressable({
  depth = 'primary',
  flat = false,
  type,
  disabled = false,
  className,
  children,
  ref,
  'aria-disabled': ariaDisabled,
  ...rest
}: PressableProps) {
  const inert = disabled || ariaDisabled === true || ariaDisabled === 'true';
  const shelf = SHELF[depth];
  const restingShelf = !flat && !disabled;
  const allowPress = !inert && !flat;
  const cursor = disabled ? 'cursor-not-allowed' : inert ? 'cursor-default' : 'cursor-pointer';

  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled}
      aria-disabled={ariaDisabled}
      className={cx(
        'select-none appearance-none outline-none',
        // release timing on the way up, press timing on the way down (motion.md)
        'transition ease-(--ease-out-soft) duration-(--duration-release) active:duration-(--duration-press)',
        restingShelf && shelf.resting,
        allowPress && shelf.press,
        allowPress && 'active:shadow-none',
        !disabled && (restingShelf ? shelf.focus : 'focus-visible:shadow-(--shadow-focus)'),
        cursor,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
