/**
 * Framework-free theme application. Toggles the `dark` class on <html> and keeps
 * the browser theme-color meta in sync. No persistence here - the caller owns
 * the preference and passes it in (storage wiring lands later).
 */

export type ThemePref = 'auto' | 'light' | 'dark';

type EffectiveTheme = 'light' | 'dark';

/* mirrors --color-surface in tokens.css */
const SURFACE_LIGHT = '#FAF2E1';
/* mirrors --color-surface (.dark) in tokens.css */
const SURFACE_DARK = '#281C0E';

const DARK_QUERY = '(prefers-color-scheme: dark)';

let watchedQuery: MediaQueryList | null = null;
let watchHandler: ((event: MediaQueryListEvent) => void) | null = null;

function canMatchMedia(): boolean {
  return typeof matchMedia === 'function';
}

function systemPrefersDark(): boolean {
  return canMatchMedia() && matchMedia(DARK_QUERY).matches;
}

function resolvePref(pref: ThemePref): EffectiveTheme {
  if (pref === 'auto') return systemPrefersDark() ? 'dark' : 'light';
  return pref;
}

function paint(theme: EffectiveTheme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  meta?.setAttribute('content', theme === 'dark' ? SURFACE_DARK : SURFACE_LIGHT);
}

function stopWatching(): void {
  if (watchedQuery && watchHandler) {
    watchedQuery.removeEventListener('change', watchHandler);
  }
  watchedQuery = null;
  watchHandler = null;
}

export function applyTheme(pref: ThemePref): void {
  stopWatching();
  paint(resolvePref(pref));
  if (pref === 'auto' && canMatchMedia()) {
    watchedQuery = matchMedia(DARK_QUERY);
    watchHandler = (event) => paint(event.matches ? 'dark' : 'light');
    watchedQuery.addEventListener('change', watchHandler);
  }
}

export function getEffectiveTheme(): EffectiveTheme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}
