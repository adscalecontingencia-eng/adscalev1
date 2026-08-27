import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, ScrollText, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TERMS_VERSION, getTermsText } from '@/lib/terms';
import { normalizeTermsLang } from '@/lib/terms-archive';
import { toast } from 'sonner';

interface LastAcceptance {
  id: string;
  client_id: string | null;
  auth_user_id: string | null;
  email: string | null;
  terms_version: string;
}

/**
 * Notifies the client whenever a new Terms of Use version is published and
 * requires a new acceptance before continuing to use the dashboard.
 */
const TermsUpdateNotice: React.FC<{ onAccepted?: () => void }> = ({ onAccepted }) => {
  const { t, i18n } = useTranslation();
  const [last, setLast] = useState<LastAcceptance | null>(null);
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from('client_terms_acceptances')
        .select('id, client_id, auth_user_id, email, terms_version')
        .eq('auth_user_id', uid)
        .order('accepted_at', { ascending: false })
        .limit(1);
      const row = ((data as any[]) || [])[0] as LastAcceptance | undefined;
      if (row && row.terms_version !== TERMS_VERSION) {
        setLast(row);
        setOpen(true);
      }
    })();
  }, []);

  const accept = async () => {
    if (!last?.auth_user_id) return;
    setSaving(true);
    const { error } = await supabase.from('client_terms_acceptances').insert({
      client_id: last.client_id,
      auth_user_id: last.auth_user_id,
      email: last.email,
      terms_version: TERMS_VERSION,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
    setSaving(false);
    if (error) {
      toast.error(t('termsUpdate.error'));
      return;
    }
    toast.success(t('termsUpdate.accepted'));
    setOpen(false);
    setLast(null);
    onAccepted?.();
  };

  if (!last) return null;

  const lang = normalizeTermsLang(i18n.language);

  return (
    <>
      {!open && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span>{t('termsUpdate.banner', { version: TERMS_VERSION })}</span>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>{t('termsUpdate.review')}</Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-primary" /> {t('termsUpdate.title')}
              <Badge variant="outline">{TERMS_VERSION}</Badge>
            </DialogTitle>
            <DialogDescription>
              {t('termsUpdate.description', { previous: last.terms_version, current: TERMS_VERSION })}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-md border border-border/50 p-3 text-xs leading-relaxed text-muted-foreground">
            {getTermsText(lang)}
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={checked} onCheckedChange={(v) => setChecked(!!v)} className="mt-0.5" />
            <span>{t('termsUpdate.checkbox')}</span>
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>{t('termsUpdate.later')}</Button>
            <Button disabled={!checked || saving} onClick={accept}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('termsUpdate.acceptButton')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TermsUpdateNotice;
