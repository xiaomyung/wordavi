/**
 * RU-pinned translator for the component gallery.
 *
 * The shared i18next instance is initialised lazily — on first render, never at
 * import time — so importing this module from App.tsx stays side-effect free for
 * the normal screens. `getFixedT` pins Russian: the gallery exists to eyeball
 * the strings the primary user actually sees, whatever language the browser
 * reports.
 */
import { init } from '@/i18n';

function buildFixedT() {
  return init({ initialLang: 'ru' }).getFixedT('ru');
}

let cached: ReturnType<typeof buildFixedT> | null = null;

export function galleryT() {
  const t = cached ?? buildFixedT();
  cached = t;
  return t;
}
