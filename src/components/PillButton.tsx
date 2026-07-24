import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from './cx';
import './answer-controls.css';

export interface PillButtonProps extends ComponentPropsWithRef<'button'> {
  /** Optional leading glyph (e.g. a speaker icon before "прослушать"). */
  glyph?: ReactNode;
  /**
   * Toggle state — accent-tint fill when on (e.g. "медленнее ×0,75" engaged).
   * Omit it entirely for a plain action chip ("прослушать"): leaving it
   * undefined drops `aria-pressed`, so an action is never announced as an
   * unpressed toggle. Pass `false` for a toggle that is currently off.
   */
  active?: boolean;
}

/**
 * Small pill chip button (speaker-button.md): "прослушать", "медленнее ×0,75",
 * offline. Surface-raised with a hairline border and caption text; `active`
 * switches to the accent-tint toggled fill. `type="button"` by default; all
 * native button props pass through.
 */
export function PillButton({ glyph, active, children, className, type, ...rest }: PillButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cx('wa-pill', className)}
      data-active={active ? 'true' : undefined}
      aria-pressed={active}
      {...rest}
    >
      {glyph}
      {children}
    </button>
  );
}
