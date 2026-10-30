import React, { useState } from 'react';
import { FileText, RotateCcw, Save, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { agencyTermsVersion, defaultAgencySignupTerms, MAX_TERMS_LENGTH } from '@/lib/agency-signup-terms';

interface Props { agencyId: string; settings: any; setSettings: (s: any) => void; brandName: string }

/** Lets the partner agency edit the Terms of Use its end clients accept on /cadastro. */
export const AgencySignupTermsEditor: React.FC<Props> = ({ agencyId, settings, setSettings, brandName }) => {
  const [pt, setPt] = useState<string>(settings.signup_terms_pt || defaultAgencySignupTerms(brandName, 'pt'));
  const [en, setEn] = useState<string>(settings.signup_terms_en || defaultAgencySignupTerms(brandName, 'en'));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (pt.trim().length < 200) return toast.error('O termo em português está muito curto.');
    if (pt.length > MAX_TERMS_LENGTH || en.length > MAX_TERMS_LENGTH) return toast.error('O termo passou do tamanho máximo.');
    setBusy(true);
    const version = agencyTermsVersion();
    const patch = { signup_terms_pt: pt.trim(), signup_terms_en: en.trim() || null, signup_terms_version: version, signup_terms_updated_at: new Date().toISOString() };
    const { error } = await supabase.from('agency_settings').upsert({ ...settings, ...patch, agency_client_id: agencyId, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return toast.error('Não foi possível salvar o termo.');
    setSettings({ ...settings, ...patch });
    toast.success(`Termo salvo (versão ${version}). Novos cadastros já veem este texto.`);
  };

  const reset = () => {
    setPt(defaultAgencySignupTerms(brandName, 'pt'));
    setEn(defaultAgencySignupTerms(brandName, 'en'));
    toast.info('Modelo padrão carregado com o nome da sua agência. Clique em Salvar para usar.');
  };

  const download = (text: string, lang: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    a.download = `termo-de-uso-${lang}.txt`; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><FileText size={16} className="text-primary" />Termo de Uso do cadastro dos seus clientes</CardTitle>
        <p className="text-xs text-muted-foreground">É o texto que seus clientes leem e aceitam na sua página de cadastro. Já vem com o nome da sua agência; ajuste como quiser. Cada vez que você salva, uma nova versão é registrada no aceite dos próximos cadastros.</p>
        {settings.signup_terms_version && <p className="text-[11px] text-muted-foreground">Versão em uso: <span className="font-mono text-primary">{settings.signup_terms_version}</span>{settings.signup_terms_updated_at && ` · salvo em ${new Date(settings.signup_terms_updated_at).toLocaleString('pt-BR')}`}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs defaultValue="pt">
          <TabsList><TabsTrigger value="pt">Português</TabsTrigger><TabsTrigger value="en">English</TabsTrigger></TabsList>
          <TabsContent value="pt"><Textarea value={pt} onChange={e => setPt(e.target.value)} className="min-h-[360px] font-mono text-[11px] leading-relaxed" /></TabsContent>
          <TabsContent value="en"><Textarea value={en} onChange={e => setEn(e.target.value)} className="min-h-[360px] font-mono text-[11px] leading-relaxed" /></TabsContent>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          <Button className="gap-2" disabled={busy} onClick={save}><Save size={14} />Salvar termo</Button>
          <Button variant="outline" className="gap-2" onClick={reset}><RotateCcw size={14} />Restaurar modelo padrão</Button>
          <Button variant="ghost" className="gap-2" onClick={() => download(pt, 'pt')}><Download size={14} />Baixar PT</Button>
          <Button variant="ghost" className="gap-2" onClick={() => download(en, 'en')}><Download size={14} />Baixar EN</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Recomendamos revisar o texto com um advogado. A responsabilidade pelo conteúdo do termo é da sua agência.</p>
      </CardContent>
    </Card>
  );
};
