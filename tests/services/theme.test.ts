import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, getEffectiveTheme } from '@/services/theme';

type ChangeHandler = (event: MediaQueryListEvent) => void;

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Installs a controllable matchMedia stub keyed to prefers-color-scheme: dark. */
function installMatchMedia(initialDark: boolean) {
  const handlers = new Set<ChangeHandler>();
  const mql = {
    matches: initialDark,
    media: DARK_QUERY,
    addEventListener: (_type: 'change', handler: ChangeHandler) => {
      handlers.add(handler);
    },
    removeEventListener: (_type: 'change', handler: ChangeHandler) => {
      handlers.delete(handler);
    },
  };
  vi.stubGlobal('matchMedia', () => mql);
  return {
    emit(dark: boolean) {
      mql.matches = dark;
      for (const handler of handlers) handler({ matches: dark } as MediaQueryListEvent);
    },
    activeHandlers: () => handlers.size,
  };
}

function metaContent(): string | null {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;
}

describe('theme service', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.head.innerHTML = '<meta name="theme-color" content="#FAF2E1" />';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.className = '';
    document.head.innerHTML = '';
  });

  it('applying an explicit dark preference adds the dark class and repaints the meta', () => {
    installMatchMedia(false);
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(getEffectiveTheme()).toBe('dark');
    expect(metaContent()).toBe('#281C0E');
  });

  it('applying an explicit light preference removes the dark class', () => {
    installMatchMedia(true);
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(getEffectiveTheme()).toBe('light');
    expect(metaContent()).toBe('#FAF2E1');
  });

  it('auto follows the matchMedia mock and reacts to system changes', () => {
    const media = installMatchMedia(true);
    applyTheme('auto');
    expect(getEffectiveTheme()).toBe('dark');
    media.emit(false);
    expect(getEffectiveTheme()).toBe('light');
    expect(metaContent()).toBe('#FAF2E1');
  });

  it('stops watching the system once a non-auto preference is applied', () => {
    const media = installMatchMedia(true);
    applyTheme('auto');
    expect(media.activeHandlers()).toBe(1);
    applyTheme('light');
    expect(media.activeHandlers()).toBe(0);
  });
});
