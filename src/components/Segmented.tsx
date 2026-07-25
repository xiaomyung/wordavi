import { type KeyboardEvent, type ReactNode, type Ref, useRef } from 'react';
import { cx } from './cx';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** BCP-47 lang for the label (e.g. 'es' for "Español"). */
  lang?: string;
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Labels the group (what the segments choose between). */
  'aria-label'?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Segmented pill control (settings.html .seg): a radiogroup with roving
 * tabindex and arrow-key navigation (selection follows focus). The 38px visual
 * pill sits inside a >=44px hit target so the touch-target rule holds while the
 * mockup geometry is preserved. Long RU/ES labels wrap; they never clip.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  'aria-label': ariaLabel,
  ref,
}: SegmentedProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const selectAt = (index: number) => {
    const count = options.length;
    const wrapped = ((index % count) + count) % count;
    const option = options[wrapped];
    if (!option) return;
    onChange(option.value);
    buttons.current[wrapped]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: number) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        selectAt(current + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        selectAt(current - 1);
        break;
      case 'Home':
        event.preventDefault();
        selectAt(0);
        break;
      case 'End':
        event.preventDefault();
        selectAt(options.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx('flex gap-1 rounded-pill bg-surface-sunken p-1', className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          // biome-ignore lint/a11y/useSemanticElements: styled pill radio; a native input can't carry this design
          <button
            key={option.value}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            lang={option.lang}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className="group flex min-h-touch flex-1 cursor-pointer appearance-none items-center justify-center bg-transparent p-0 outline-none focus-visible:shadow-none"
          >
            <span
              className={cx(
                'flex min-h-[2.375rem] w-full items-center justify-center break-words rounded-pill px-2 py-1 text-center text-label leading-tight',
                'transition duration-(--duration-text) ease-(--ease-out-soft) group-focus-visible:shadow-(--shadow-focus)',
                selected
                  ? 'bg-surface-raised font-extrabold text-text shadow-[0_var(--stroke-hairline)_0_var(--color-border-strong)]'
                  : 'font-bold text-text-muted',
              )}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
