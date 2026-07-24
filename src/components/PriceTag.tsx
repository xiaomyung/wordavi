import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';

/**
 * PriceTag — grocery-mode price prompt. See
 * design-handoff/wordavi-design-v1/components/price-tag.md.
 *
 * Auto-shrink: rather than measuring the rendered box (layout thrashing,
 * ResizeObserver plumbing for a presentational leaf), the font size is a pure
 * function of the string's code-point length. Short prices ("2,35 €") render
 * at the full --text-prompt-lg (56px); every character past
 * PRICE_TAG_SHRINK_START steps the size down by PRICE_TAG_PX_PER_CHAR,
 * floored at PRICE_TAG_MIN_PX, which was picked so the longest realistic
 * content ("dos kilos y medio") still fits one line at a 360px viewport.
 */
export interface PriceTagProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  children: string;
}

const PRICE_TAG_BASE_PX = 56;
const PRICE_TAG_MIN_PX = 22;
const PRICE_TAG_SHRINK_START = 7;
const PRICE_TAG_PX_PER_CHAR = 2.4;

export function computePriceTagFontSizePx(text: string): number {
  const length = Array.from(text).length;
  if (length <= PRICE_TAG_SHRINK_START) return PRICE_TAG_BASE_PX;
  const shrink = (length - PRICE_TAG_SHRINK_START) * PRICE_TAG_PX_PER_CHAR;
  return Math.max(PRICE_TAG_MIN_PX, PRICE_TAG_BASE_PX - shrink);
}

export function PriceTag({ children, className, ref, ...rest }: PriceTagProps) {
  return (
    <div
      ref={ref}
      className={cx(
        // w-fit: the tag hugs its value like a real shelf label (drill-grocery.html
        // centres it in a shrink-wrapping column); as a plain block it would
        // stretch to the container and read as a flat bar.
        '-rotate-1 relative w-fit rounded-input border border-border bg-surface-raised py-4.5 pr-7.5 pl-10.5 shadow-tag',
        "before:absolute before:top-1/2 before:left-4 before:size-(--size-hole-tag) before:-translate-y-1/2 before:rounded-full before:border-[1.5px] before:border-hole-ring before:bg-hole-bg before:content-['']",
        className,
      )}
      {...rest}
    >
      <b
        className="block whitespace-nowrap font-bold font-display leading-none numerals"
        style={{ fontSize: `${computePriceTagFontSizePx(children)}px` }}
      >
        {children}
      </b>
    </div>
  );
}
