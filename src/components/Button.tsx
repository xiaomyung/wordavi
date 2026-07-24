import type { ButtonHTMLAttributes, Ref } from 'react';
import { cx } from './cx';
import { Pressable } from './Pressable';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon';
export type ButtonSize = 'default' | 'tall';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Applies to primary/secondary only: 'tall' = 60px (onboarding CTAs). */
  size?: ButtonSize;
  ref?: Ref<HTMLButtonElement>;
}

const BASE = 'inline-flex items-center justify-center font-sans';

// 17px default label has no type token (buttons.md: "--text-label +2"); tall
// uses --text-body-lg (18). 1.5px borders / glyph sizing have no token either.
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'gap-2.5 rounded-button px-7 bg-accent text-on-accent font-extrabold ' +
    'active:bg-accent-pressed disabled:bg-disabled-bg disabled:text-disabled-text',
  secondary:
    'gap-2.5 rounded-button px-7 border-[1.5px] border-border bg-surface-raised text-text font-extrabold ' +
    'active:bg-surface-sunken disabled:border-transparent disabled:bg-disabled-bg disabled:text-disabled-text',
  ghost:
    'min-h-touch gap-2 px-4 text-label font-extrabold text-accent ' +
    'active:text-accent-pressed disabled:text-disabled-text',
  icon:
    'size-(--size-icon-button) rounded-key border border-border bg-surface-raised text-text-muted ' +
    'active:bg-surface-sunken disabled:border-transparent disabled:bg-disabled-bg disabled:text-disabled-text ' +
    '[&>svg]:size-(--size-icon-glyph)',
};

const SIZE: Record<ButtonSize, string> = {
  default: 'h-(--size-cta) text-[1.0625rem]',
  tall: 'h-(--size-cta-tall) text-body-lg',
};

/**
 * CTA and control buttons. Primary/secondary/icon carry shelf physics via
 * Pressable; ghost is flat (colour-only press). Labels wrap, never ellipsize.
 */
export function Button({
  variant = 'primary',
  size = 'default',
  className,
  ref,
  ...rest
}: ButtonProps) {
  const isCta = variant === 'primary' || variant === 'secondary';
  return (
    <Pressable
      ref={ref}
      depth={variant === 'primary' ? 'primary' : 'raised'}
      flat={variant === 'ghost'}
      className={cx(BASE, VARIANT[variant], isCta && SIZE[size], className)}
      {...rest}
    />
  );
}
