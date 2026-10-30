import { TERMS_OF_USE_TEXT, TERMS_OF_USE_TEXT_EN, TERMS_VERSION } from '@/lib/terms';

export const MAX_TERMS_LENGTH = 60000;

/** Standard signup terms with AD SCALE swapped for the agency's own name (whitelabel default). */
export function defaultAgencySignupTerms(brandName: string | null | undefined, lang: 'pt' | 'en'): string {
  const base = lang === 'en' ? TERMS_OF_USE_TEXT_EN : TERMS_OF_USE_TEXT;
  const name = (brandName || '').trim() || (lang === 'en' ? 'THE AGENCY' : 'A AGÊNCIA');
  return base.replace(/AD\s?SCALE|AdScale/gi, name);
}

/** Version stamp saved with each edit, so every signup acceptance points to the exact text accepted. */
export function agencyTermsVersion(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `ag-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.${p(date.getHours())}${p(date.getMinutes())}`;
}

export interface AgencySignupTerms { brand_name: string | null; terms_pt: string | null; terms_en: string | null; terms_version: string | null }

/** Text + version shown on an agency's /cadastro page: custom text when saved, otherwise the branded default. */
export function resolveAgencySignupTerms(t: AgencySignupTerms, lang?: string): { text: string; version: string } {
  const en = (lang || 'pt').slice(0, 2) === 'en';
  const custom = (en ? t.terms_en || t.terms_pt : t.terms_pt || t.terms_en)?.trim();
  if (custom && t.terms_version) return { text: custom, version: t.terms_version };
  return { text: defaultAgencySignupTerms(t.brand_name, en ? 'en' : 'pt'), version: `${TERMS_VERSION}-ag` };
}
