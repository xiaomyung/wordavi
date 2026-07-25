import type { Ref } from 'react';
import { cx } from './cx';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Switch: 54x32 track, 24px knob, 3px inset travel. The button is padded to a
 * >=44px hit area around the visual track. The track colour sits on its own
 * layer so the disabled 50% dim never reaches the knob (toggle.md). Focus ring
 * hugs the track; the padded hit box suppresses its own ring.
 */
export function Toggle({
  checked,
  onChange,
  disabled = false,
  className,
  id,
  ref,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
}: ToggleProps) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'group inline-flex shrink-0 appearance-none items-center justify-center bg-transparent p-1.5 outline-none',
        'focus-visible:shadow-none',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        className,
      )}
    >
      <span className="relative flex h-(--size-toggle-h) w-(--size-toggle-w) rounded-pill group-focus-visible:shadow-(--shadow-focus)">
        <span
          className={cx(
            'absolute inset-0 rounded-pill transition-colors duration-(--duration-toggle) ease-(--ease-out-soft)',
            checked ? 'bg-accent' : 'border border-border bg-surface-sunken',
            disabled && 'opacity-50',
          )}
        />
        <span
          className={cx(
            'absolute top-1/2 left-[3px] size-(--size-knob) -translate-y-1/2 rounded-full',
            'transition-transform duration-(--duration-toggle) ease-(--ease-out-soft)',
            checked
              ? 'translate-x-6 bg-on-accent shadow-[0_var(--stroke-hairline)_0_var(--color-accent-shelf)]'
              : 'translate-x-0 border border-border bg-surface-raised shadow-[0_var(--stroke-hairline)_0_var(--color-border-strong)]',
          )}
        />
      </span>
    </button>
  );
}
