import { useTranslation } from 'react-i18next';
import { ptBR, enUS, es as esLocale } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import i18n from '@/i18n';

/** date-fns locale for the given (or current) UI language. */
export function getDateLocale(lng: string = i18n.language): Locale {
  if (lng?.startsWith('en')) return enUS;
  if (lng?.startsWith('es')) return esLocale;
  return ptBR;
}

/** Intl/BCP-47 locale for numbers and dates in the given (or current) UI language. */
export function getNumberLocale(lng: string = i18n.language): string {
  if (lng?.startsWith('en')) return 'en-US';
  if (lng?.startsWith('es')) return 'es-ES';
  return 'pt-BR';
}

/** Re-renders when the language changes. Use in components that format dates/numbers. */
export function useLocaleFormat() {
  const { i18n: inst } = useTranslation();
  const lng = inst.language;
  return { dateLocale: getDateLocale(lng), numberLocale: getNumberLocale(lng), lng };
}
