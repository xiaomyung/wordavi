import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from './cx';

/**
 * Toast — float pill/card. See design-handoff/wordavi-design-v1/components/toast.md.
 *
 * Purely presentational: `open` drives the fade + 6px rise (200ms). Whether a
 * toast stays mounted long enough to play its exit transition, and when it
 * auto-dismisses, is a `services/toast` concern — this component never owns
 * a timer or a store.
 */
export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  open: boolean;
  text: string;
  icon?: ReactNode;
  action?: ToastAction;
}

export function Toast({ open, text, icon, action, className, ref, ...rest }: ToastProps) {
  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className={cx(
        'flex items-center gap-3 rounded-input border border-border bg-surface-raised px-4 py-3.5 shadow-float',
        'transition-[opacity,transform] duration-(--duration-text) ease-out',
        open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1.5 opacity-0',
        className,
      )}
      {...rest}
    >
      {icon ? <span className="shrink-0 text-text-muted">{icon}</span> : null}
      <span className="flex-1 text-[14px] font-semibold text-text">{text}</span>
      {action ? (
        <button
          type="button"
          onClick={action.onPress}
          className="min-h-touch shrink-0 px-1 text-[14.5px] font-extrabold text-accent"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

export interface ToasterItem {
  id: string;
  text: string;
  icon?: ReactNode;
  action?: ToastAction;
  /** Defaults to true — pass false while a service animates the exit out. */
  open?: boolean;
}

export interface ToasterProps {
  items: readonly ToasterItem[];
  className?: string;
}

/**
 * Bottom-centered stacking container — the default placement from toast.md.
 * Screens that need a different position (top-of-safe-area on Home, above
 * the CTA on drill screens) render `Toast` directly instead of this wrapper.
 */
export function Toaster({ items, className }: ToasterProps) {
  return (
    <div
      className={cx(
        'pointer-events-none fixed inset-x-0 bottom-(--spacing-screen) z-50 flex flex-col items-center gap-2 px-screen',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto w-full max-w-sm">
          <Toast
            open={item.open ?? true}
            text={item.text}
            {...(item.icon !== undefined ? { icon: item.icon } : {})}
            {...(item.action !== undefined ? { action: item.action } : {})}
          />
        </div>
      ))}
    </div>
  );
}
