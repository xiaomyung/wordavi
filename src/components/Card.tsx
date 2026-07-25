import type { ComponentPropsWithRef, ReactNode, Ref } from 'react';
import { cx } from './cx';
import { RowChevron } from './glyphs';

/**
 * Card — see design-handoff/wordavi-design-v1/components/cards.md.
 *
 * - `raised`: the default shelf card (surface-raised, border, shadow-shelf-raised, 16px pad).
 * - `grouped`: zero-padding shell for a list of `CardRow`s separated by hairline rules.
 * - `float`: raised card swapped to shadow-float (toasts, sheets, install prompt).
 * - `paused`: dashed, dimmed shell for offline/unavailable content.
 */
export type CardVariant = 'raised' | 'grouped' | 'float' | 'paused';

export interface CardProps extends ComponentPropsWithRef<'div'> {
  variant?: CardVariant;
  children?: ReactNode;
}

const BASE_CLASS = 'rounded-card';

const VARIANT_CLASS: Record<CardVariant, string> = {
  raised: 'bg-surface-raised border border-border shadow-shelf-raised p-4 flex flex-col gap-3',
  grouped:
    'bg-surface-raised border border-border shadow-shelf-raised divide-y divide-surface-sunken',
  float: 'bg-surface-raised border border-border shadow-float p-4 flex flex-col gap-3',
  // same internal stack as raised/float — without it the title and subtitle
  // are inline spans and run together on one line (cards.md keeps the paused
  // card the same shape, only dimmed).
  paused:
    'bg-surface-paused border-(length:--stroke-hairline) border-dashed border-border-strong p-4 flex flex-col gap-3 opacity-90',
};

export function Card({ variant = 'raised', className, children, ref, ...rest }: CardProps) {
  return (
    <div ref={ref} className={cx(BASE_CLASS, VARIANT_CLASS[variant], className)} {...rest}>
      {children}
    </div>
  );
}

export interface CardRowProps {
  label: ReactNode;
  sub?: ReactNode;
  trailing?: ReactNode;
  /** When provided, the row renders as a full-width button and grows a trailing chevron. */
  onPress?: () => void;
  className?: string;
  id?: string;
  ref?: Ref<HTMLButtonElement | HTMLDivElement>;
}

/**
 * One row of a `grouped` Card. Rows are separated by the parent's `divide-y`
 * hairline rule (surface-sunken). Passing `onPress` turns the row into a real
 * `<button>` (nav row) and appends a trailing chevron.
 */
export function CardRow({ label, sub, trailing, onPress, className, id, ref }: CardRowProps) {
  const content = (
    <>
      <span className="flex flex-1 flex-col gap-0.5 text-left">
        <span className="text-sub-strong font-extrabold">{label}</span>
        {sub ? <span className="text-caption font-semibold text-text-muted">{sub}</span> : null}
      </span>
      {trailing}
      {onPress ? <RowChevron /> : null}
    </>
  );

  const rowClassName = cx('flex w-full items-center gap-3 px-4 py-3.5 text-text', className);

  if (onPress) {
    return (
      <button
        ref={ref as Ref<HTMLButtonElement>}
        type="button"
        id={id}
        onClick={onPress}
        className={rowClassName}
      >
        {content}
      </button>
    );
  }

  return (
    <div ref={ref as Ref<HTMLDivElement>} id={id} className={rowClassName}>
      {content}
    </div>
  );
}
