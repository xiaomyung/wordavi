import type { ReactNode } from 'react';
import './screen-transition.css';

export interface ScreenTransitionProps {
  /** Remount key — pass the screen kind so each screen change replays the enter. */
  screenKey: string;
  children: ReactNode;
}

/**
 * Fades + rises each screen in on mount. Keyed on the screen kind rather than
 * wrapping every screen individually, so screens stay plain prop-driven
 * components with no knowledge of navigation.
 */
export function ScreenTransition({ screenKey, children }: ScreenTransitionProps) {
  return (
    <div key={screenKey} className="wa-screen" data-screen={screenKey}>
      {children}
    </div>
  );
}
