import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './resources/en.json';
import es from './resources/es.json';
import ru from './resources/ru.json';

const supportedLangs = ['ru', 'en', 'es'] as const;

export type SupportedLang = (typeof supportedLangs)[number];

/**
 * i18n sits below `services` in the layer contract, so it cannot import the
 * logger. These two failures are also the only ones the app can do nothing
 * about (a bundled resource tree failing to install), which is why they go
 * straight to the console instead of through a callback nobody would wire.
 */
function reportI18nError(stage: string): (error: unknown) => void {
  return (error: unknown) => {
    console.error(`[i18n] ${stage} failed`, error);
  };
}

const resources = {
  ru: { translation: ru },
  en: { translation: en },
  es: { translation: es },
} as const;

function isSupportedLang(value: string): value is SupportedLang {
  return (supportedLangs as readonly string[]).includes(value);
}

/**
 * Exported for `app/bootstrap.ts`: a first run has no chosen language, so the
 * visitor's browser decides what the very first screen speaks. First supported
 * entry in `navigator.languages` wins; anything else falls back to English.
 */
export function detectLanguage(explicitLang?: string): SupportedLang {
  if (explicitLang && isSupportedLang(explicitLang)) return explicitLang;

  const candidates =
    typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : [];

  for (const candidate of candidates) {
    const base = candidate.split('-')[0]?.toLowerCase();
    if (base && isSupportedLang(base)) return base;
  }

  return 'en';
}

export interface InitOptions {
  initialLang?: string;
}

export function init(options: InitOptions = {}): typeof i18next {
  const lng = detectLanguage(options.initialLang);

  if (!i18next.isInitialized) {
    i18next
      .use(initReactI18next)
      .init({
        resources,
        lng,
        fallbackLng: 'en',
        supportedLngs: [...supportedLangs],
        defaultNS: 'translation',
        interpolation: { escapeValue: false },
        returnNull: false,
      })
      .catch(reportI18nError('init'));
  }

  setLanguage(lng);
  return i18next;
}

export function setLanguage(lang: SupportedLang): void {
  i18next.changeLanguage(lang).catch(reportI18nError('changeLanguage'));
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
}

export default i18next;
