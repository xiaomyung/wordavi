import type { Ref } from 'react';
import { cx } from './cx';

const ACCENT_CHARS = ['á', 'é', 'í', 'ó', 'ú', 'ñ'] as const;

export interface AccentKeysProps {
  onInsert: (char: string) => void;
  disabled?: boolean;
  className?: string;
  /** Accessible label for the key group (localized by the caller). */
  label?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Row of six diacritic keys docked above the keyboard in word-answer modes.
 * Not built on Pressable: the sink uses the single-phase --duration-key (70ms)
 * rather than the shelf primitive's two-phase press/release timing. Keys stay
 * tab-focusable, but preventDefault on mousedown stops them stealing focus so
 * the answer field keeps its caret; onInsert fires on click (no long-press
 * repeat). Glyph uses --text-verdict (23px value) in the display serif.
 */
export function AccentKeys({ onInsert, disabled = false, label, className, ref }: AccentKeysProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a presentational key toolbar, not a form fieldset
    <div ref={ref} role="group" aria-label={label} className={cx('flex gap-2', className)}>
      {ACCENT_CHARS.map((char) => (
        <button
          key={char}
          type="button"
          lang="es"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onInsert(char)}
          className={cx(
            'inline-flex h-(--size-key) flex-1 items-center justify-center rounded-key',
            'border border-border bg-surface-raised font-display text-verdict font-medium text-text',
            'shadow-(--shadow-shelf-raised) transition ease-(--ease-out-soft) duration-(--duration-key)',
            'cursor-pointer select-none appearance-none outline-none',
            'active:translate-y-[2px] active:bg-surface-sunken active:shadow-none',
            'focus-visible:shadow-[var(--shadow-focus),var(--shadow-shelf-raised)]',
            'disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:text-disabled-text disabled:shadow-none',
          )}
        >
          {char}
        </button>
      ))}
    </div>
  );
}
