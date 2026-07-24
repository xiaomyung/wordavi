import type { ComponentPropsWithRef, ReactNode, Ref } from 'react';
import { cx } from './cx';

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
  paused: 'bg-surface-paused border-[1.5px] border-dashed border-border-strong p-4 opacity-90',
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

/**
 * One row of a `grouped` Card. Rows are separated by the parent's `divide-y`
 * hairline rule (surface-sunken). Passing `onPress` turns the row into a real
 * `<button>` (nav row) and appends a trailing chevron.
 */
export function CardRow({ label, sub, trailing, onPress, className, id, ref }: CardRowProps) {
  const content = (
    <>
      <span className="flex flex-1 flex-col gap-0.5 text-left">
        <span className="text-[15px] font-extrabold">{label}</span>
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
