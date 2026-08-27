/**
 * Resolve the exact Terms of Use text for a given accepted version.
 * Current version comes from the bundled constants; older/other versions
 * are looked up in the `terms_versions` table (snapshots).
 */
import { supabase } from '@/integrations/supabase/client';
import { TERMS_VERSION, TERMS_OF_USE_TEXT, TERMS_OF_USE_TEXT_EN } from '@/lib/terms';

export type TermsLang = 'pt' | 'en';

export const normalizeTermsLang = (lang?: string): TermsLang =>
  (lang || 'pt').toLowerCase().startsWith('en') ? 'en' : 'pt';

export interface ResolvedTerms {
  version: string;
  language: TermsLang;
  text: string | null;
  archived: boolean;
}

export async function resolveTermsText(version: string, lang?: string): Promise<ResolvedTerms> {
  const language = normalizeTermsLang(lang);

  if (version === TERMS_VERSION) {
    return {
      version,
      language,
      text: language === 'en' ? TERMS_OF_USE_TEXT_EN : TERMS_OF_USE_TEXT,
      archived: false,
    };
  }

  const { data } = await supabase
    .from('terms_versions')
    .select('version, content_pt, content_en')
    .eq('version', version)
    .maybeSingle();

  if (data) {
    const text = language === 'en' ? (data.content_en || data.content_pt) : data.content_pt;
    return { version, language, text, archived: true };
  }

  return { version, language, text: null, archived: true };
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function logTermsAccess(params: {
  acceptanceId?: string | null;
  clientId?: string | null;
  authUserId: string;
  email?: string | null;
  version: string;
  action: 'view' | 'download';
  language: TermsLang;
  format?: string;
}) {
  try {
    await supabase.from('terms_download_log').insert({
      acceptance_id: params.acceptanceId || null,
      client_id: params.clientId || null,
      auth_user_id: params.authUserId,
      email: params.email || null,
      terms_version: params.version,
      action: params.action,
      format: params.format || (params.action === 'download' ? 'txt' : 'html'),
      language: params.language,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  } catch {
    /* logging must never break the download */
  }
}
