import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import pt from './locales/pt';
import en from './locales/en';
import es from './locales/es';

export const SUPPORTED_LANGUAGES = ['pt', 'en', 'es'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = 'adscale.lang';

function normalize(lng?: string | null): SupportedLanguage {
  if (!lng) return 'pt';
  const base = lng.toLowerCase().split('-')[0];
  if (base === 'en') return 'en';
  if (base === 'es') return 'es';
  return 'pt';
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: pt },
      en: { translation: en },
      es: { translation: es },
    },
    fallbackLng: 'pt',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
    returnEmptyString: false,
  });

// Force normalization to a supported language on init.
i18n.changeLanguage(normalize(i18n.language));

export function setLanguage(lng: SupportedLanguage) {
  i18n.changeLanguage(lng);
  try { localStorage.setItem(STORAGE_KEY, lng); } catch { /* ignore */ }
}

export function getLanguage(): SupportedLanguage {
  return normalize(i18n.language);
}

export { normalize as normalizeLanguage };
export default i18n;
