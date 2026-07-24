import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './resources/en.json';
import es from './resources/es.json';
import ru from './resources/ru.json';

export const supportedLangs = ['ru', 'en', 'es'] as const;

export type SupportedLang = (typeof supportedLangs)[number];

const resources = {
  ru: { translation: ru },
  en: { translation: en },
  es: { translation: es },
} as const;

function isSupportedLang(value: string): value is SupportedLang {
  return (supportedLangs as readonly string[]).includes(value);
}

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
    void i18next.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: 'en',
      supportedLngs: [...supportedLangs],
      defaultNS: 'translation',
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  }

  setLanguage(lng);
  return i18next;
}

export function setLanguage(lang: SupportedLang): void {
  void i18next.changeLanguage(lang);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
}

export default i18next;
