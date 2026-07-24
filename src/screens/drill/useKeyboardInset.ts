import { useEffect, useState } from 'react';

/**
 * Height in px currently covered by the software keyboard.
 *
 * `visualViewport` shrinks when the keyboard opens on iOS/Android without the
 * layout viewport changing, so a bottom-anchored CTA would otherwise sit behind
 * the keys. The drill pads its answer zone by this value to keep the CTA and the
 * accent-key row docked directly above the keyboard.
 *
 * Returns 0 wherever `visualViewport` is unavailable (desktop, jsdom/happy-dom),
 * which is exactly the "no keyboard" layout.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = typeof window === 'undefined' ? undefined : window.visualViewport;
    if (!viewport) return;

    const measure = (): void => {
      const covered = window.innerHeight - (viewport.height + viewport.offsetTop);
      // Sub-pixel viewport rounding reports 1-2px of phantom inset; ignore it.
      setInset(covered > 1 ? Math.round(covered) : 0);
    };

    measure();
    viewport.addEventListener('resize', measure);
    viewport.addEventListener('scroll', measure);
    return () => {
      viewport.removeEventListener('resize', measure);
      viewport.removeEventListener('scroll', measure);
    };
  }, []);

  return inset;
}
