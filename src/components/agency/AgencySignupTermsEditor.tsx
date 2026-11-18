import React, { useState } from 'react';
import { tr } from '@/i18n';
import { FileText, RotateCcw, Save, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { getNumberLocale } from '@/i18n/format';
import { agencyTermsVersion, defaultAgencySignupTerms, MAX_TERMS_LENGTH } from '@/lib/agency-signup-terms';

interface Props { agencyId: string; settings: any; setSettings: (s: any) => void; brandName: string }

/** Lets the partner agency edit the Terms of Use its end clients accept on /cadastro. */
export const AgencySignupTermsEditor: React.FC<Props> = ({ agencyId, settings, setSettings, brandName }) => {
  const [pt, setPt] = useState<string>(settings.signup_terms_pt || defaultAgencySignupTerms(brandName, 'pt'));
  const [en, setEn] = useState<string>(settings.signup_terms_en || defaultAgencySignupTerms(brandName, 'en'));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (pt.trim().length < 200) return toast.error(tr('agency.terms.tooShort'));
    if (pt.length > MAX_TERMS_LENGTH || en.length > MAX_TERMS_LENGTH) return toast.error(tr('agency.terms.tooLong'));
    setBusy(true);
    const version = agencyTermsVersion();
    const patch = { signup_terms_pt: pt.trim(), signup_terms_en: en.trim() || null, signup_terms_version: version, signup_terms_updated_at: new Date().toISOString() };
    const { error } = await supabase.from('agency_settings').upsert({ ...settings, ...patch, agency_client_id: agencyId, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return toast.error(tr('agency.terms.saveError'));
    setSettings({ ...settings, ...patch });
    toast.success(tr('agency.terms.saved', { version }));
  };

  const reset = () => {
    setPt(defaultAgencySignupTerms(brandName, 'pt'));
    setEn(defaultAgencySignupTerms(brandName, 'en'));
    toast.info(tr('agency.terms.resetDone'));
  };

  const download = (text: string, lang: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    a.download = `termo-de-uso-${lang}.txt`; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><FileText size={16} className="text-primary" />{tr('agency.terms.title')}</CardTitle>
        <p className="text-xs text-muted-foreground">{tr('agency.terms.desc')}</p>
        {settings.signup_terms_version && <p className="text-[11px] text-muted-foreground">{tr('agency.terms.inUse')} <span className="font-mono text-primary">{settings.signup_terms_version}</span>{settings.signup_terms_updated_at && ` ${tr('agency.terms.savedAt', { when: new Date(settings.signup_terms_updated_at).toLocaleString(getNumberLocale()) })}`}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs defaultValue="pt">
          <TabsList><TabsTrigger value="pt">Português</TabsTrigger><TabsTrigger value="en">English</TabsTrigger></TabsList>
          <TabsContent value="pt"><Textarea value={pt} onChange={e => setPt(e.target.value)} className="min-h-[360px] font-mono text-[11px] leading-relaxed" /></TabsContent>
          <TabsContent value="en"><Textarea value={en} onChange={e => setEn(e.target.value)} className="min-h-[360px] font-mono text-[11px] leading-relaxed" /></TabsContent>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          <Button className="gap-2" disabled={busy} onClick={save}><Save size={14} />{tr('agency.terms.saveTerms')}</Button>
          <Button variant="outline" className="gap-2" onClick={reset}><RotateCcw size={14} />{tr('agency.terms.restore')}</Button>
          <Button variant="ghost" className="gap-2" onClick={() => download(pt, 'pt')}><Download size={14} />{tr('agency.terms.dlPt')}</Button>
          <Button variant="ghost" className="gap-2" onClick={() => download(en, 'en')}><Download size={14} />{tr('agency.terms.dlEn')}</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">{tr('agency.terms.lawyer')}</p>
      </CardContent>
    </Card>
  );
};
