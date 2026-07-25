import type { ReactNode, Ref } from 'react';
import { cx } from './cx';
import { Pressable } from './Pressable';

export interface StepperProps {
  /** Value display — number, string, or a glyph like the endless-round infinity. */
  children: ReactNode;
  onDecrement: () => void;
  onIncrement: () => void;
  canDecrement?: boolean;
  canIncrement?: boolean;
  /** aria-labels for the buttons; callers pass localized strings. */
  decrementLabel?: string;
  incrementLabel?: string;
  className?: string;
  /** Labels the whole control (what the value adjusts). */
  'aria-label'?: string;
  ref?: Ref<HTMLDivElement>;
}

// 44px keys (settings.html .step); +/- glyph is 20px (no type token).
const STEP_BTN =
  'inline-flex size-(--size-icon-button) items-center justify-center rounded-key border border-border ' +
  'bg-surface-raised text-[1.25rem] font-extrabold active:bg-surface-sunken ' +
  'disabled:border-transparent disabled:bg-disabled-bg disabled:text-disabled-text';

/** [-][value][+] stepper. Value slot renders any content; live region announces changes. */
export function Stepper({
  children,
  onDecrement,
  onIncrement,
  canDecrement = true,
  canIncrement = true,
  decrementLabel = 'Decrease',
  incrementLabel = 'Increase',
  className,
  'aria-label': ariaLabel,
  ref,
}: StepperProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a grouping wrapper for the control, not a form fieldset
    <div
      ref={ref}
      role="group"
      aria-label={ariaLabel}
      className={cx('flex items-center gap-2.5', className)}
    >
      <Pressable
        depth="raised"
        onClick={onDecrement}
        disabled={!canDecrement}
        aria-label={decrementLabel}
        className={cx(STEP_BTN, 'text-text-muted')}
      >
        <span aria-hidden="true">−</span>
      </Pressable>
      <span
        aria-live="polite"
        className="min-w-(--size-icon-button) px-1 text-center font-display text-verdict font-bold text-text numerals"
      >
        {children}
      </span>
      <Pressable
        depth="raised"
        onClick={onIncrement}
        disabled={!canIncrement}
        aria-label={incrementLabel}
        className={cx(STEP_BTN, 'text-accent')}
      >
        <span aria-hidden="true">+</span>
      </Pressable>
    </div>
  );
}
