import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollText, Download, Eye, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { resolveTermsText, downloadTextFile, logTermsAccess, normalizeTermsLang } from '@/lib/terms-archive';
import { toast } from 'sonner';

interface Acceptance {
  id: string;
  client_id: string | null;
  auth_user_id: string | null;
  email: string | null;
  terms_version: string;
  accepted_at: string;
  ip_address: string | null;
}

const MyTermsAcceptance: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [row, setRow] = useState<Acceptance | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) { setLoading(false); return; }
      const { data } = await supabase
        .from('client_terms_acceptances')
        .select('*')
        .eq('auth_user_id', uid)
        .order('accepted_at', { ascending: false })
        .limit(1);
      setRow(((data as any[]) || [])[0] || null);
      setLoading(false);
    })();
  }, []);

  const getText = useCallback(async () => {
    if (!row) return null;
    const res = await resolveTermsText(row.terms_version, i18n.language);
    if (!res.text) {
      toast.error(t('termsRecord.unavailable'));
      return null;
    }
    return res;
  }, [row, i18n.language, t]);

  const handle = async (action: 'view' | 'download') => {
    if (!row) return;
    setBusy(true);
    try {
      const res = await getText();
      if (!res?.text) return;
      const lang = normalizeTermsLang(i18n.language);
      if (action === 'view') {
        setPreview(res.text);
      } else {
        downloadTextFile(`ad-scale-terms-${row.terms_version}-${lang}.txt`, res.text);
        toast.success(t('termsRecord.downloaded'));
      }
      if (row.auth_user_id) {
        await logTermsAccess({
          acceptanceId: row.id,
          clientId: row.client_id,
          authUserId: row.auth_user_id,
          email: row.email,
          version: row.terms_version,
          action,
          language: lang,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading || !row) return null;

  return (
    <>
      <Card className="p-4 mt-6 border-border/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <ScrollText className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">{t('termsRecord.title')}</p>
              <p className="text-xs text-muted-foreground">
                {t('termsRecord.acceptedOn', {
                  date: new Date(row.accepted_at).toLocaleString(i18n.language),
                })}
                {row.ip_address ? ` · IP ${row.ip_address}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{row.terms_version}</Badge>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => handle('view')}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              <span className="ml-1">{t('termsRecord.view')}</span>
            </Button>
            <Button size="sm" disabled={busy} onClick={() => handle('download')}>
              <Download className="h-4 w-4" />
              <span className="ml-1">{t('termsRecord.download')}</span>
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('termsRecord.title')} · {row.terms_version}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
            {preview}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MyTermsAcceptance;
