import React, { useCallback, useEffect, useState } from 'react';
import { tr, localizedMap } from '@/i18n';
import { Globe, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { DEFAULT_DOMAIN_IP, dnsRecordsFor } from '@/lib/custom-domain';

const LABEL: Record<string, string> = localizedMap('fin.dom.st', { solicitado: 'Solicitado', dns_pendente: 'Aguardando DNS da agência', ativo: 'Ativo', erro: 'Precisa de ajuste' });

/** AD SCALE side of the agency custom-domain flow: connect the domain to the app and hand the DNS records to the agency. */
export const AdminAgencyDomains: React.FC<{ agencyNames: Record<string, string> }> = ({ agencyNames }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [help, setHelp] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('agency_settings')
      .select('agency_client_id, brand_name, custom_domain, domain_status, domain_a_ip, domain_txt_value, domain_requested_at, domain_admin_note')
      .not('custom_domain', 'is', null).order('domain_requested_at', { ascending: false });
    setRows((data || []).map((r: any) => ({ ...r, domain_a_ip: r.domain_a_ip || DEFAULT_DOMAIN_IP })));
  }, []);
  useEffect(() => { load(); }, [load]);

  const upd = (id: string, patch: any) => setRows(rs => rs.map(r => r.agency_client_id === id ? { ...r, ...patch } : r));

  const save = async (r: any, status: string) => {
    if (status === 'dns_pendente' && !String(r.domain_txt_value || '').startsWith('lovable_verify=')) return toast.error(tr('fin.dom.needTxt'));
    const { error } = await supabase.from('agency_settings').update({
      domain_a_ip: r.domain_a_ip?.trim() || DEFAULT_DOMAIN_IP, domain_txt_value: r.domain_txt_value?.trim() || null,
      domain_admin_note: r.domain_admin_note?.trim() || null, domain_status: status,
      domain_activated_at: status === 'ativo' ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
    }).eq('agency_client_id', r.agency_client_id);
    if (error) return toast.error(tr('fin.dom.saveError'));
    toast.success(status === 'dns_pendente' ? tr('fin.dom.released') : status === 'ativo' ? tr('fin.dom.activated') : tr('fin.dom.saved'));
    load();
  };

  const pending = rows.filter(r => r.domain_status === 'solicitado').length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Globe size={16} className="text-primary" />{tr('fin.dom.title')}
          {pending > 0 && <span className="text-[10px] px-2 py-0.5 rounded bg-warning/15 text-warning">{tr('fin.dom.newReq', { n: pending })}</span>}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <button type="button" onClick={() => setHelp(!help)} className="w-full flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs hover:bg-secondary/40">
          <span dangerouslySetInnerHTML={{ __html: tr('fin.dom.howTo') }} /><ChevronDown size={13} className={help ? 'rotate-180' : ''} />
        </button>
        {help && (
          <ol className="text-xs text-muted-foreground list-decimal pl-5 space-y-1">
            <li dangerouslySetInnerHTML={{ __html: tr('fin.dom.s1') }} />
            <li dangerouslySetInnerHTML={{ __html: tr('fin.dom.s2') }} />
            <li dangerouslySetInnerHTML={{ __html: tr('fin.dom.s3') }} />
            <li dangerouslySetInnerHTML={{ __html: tr('fin.dom.s4') }} />
            <li dangerouslySetInnerHTML={{ __html: tr('fin.dom.s5') }} />
          </ol>
        )}
        {rows.map(r => {
          const [a, txt] = dnsRecordsFor(r.custom_domain, r.domain_a_ip, r.domain_txt_value);
          return (
            <div key={r.agency_client_id} className="rounded-lg border border-border/60 p-3 space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{agencyNames[r.agency_client_id] || r.brand_name || tr('fin.dom.agency')}</span>
                <span className="font-mono text-primary">{r.custom_domain}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-secondary">{LABEL[r.domain_status] || tr('fin.dom.noReq')}</span>
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                <div><label className="text-[10px] text-muted-foreground">A · {a.name} → IP</label><Input value={r.domain_a_ip || ''} onChange={e => upd(r.agency_client_id, { domain_a_ip: e.target.value })} /></div>
                <div className="sm:col-span-2"><label className="text-[10px] text-muted-foreground">TXT · {txt.name} → {tr('fin.dom.code')}</label><Input placeholder="lovable_verify=..." value={r.domain_txt_value || ''} onChange={e => upd(r.agency_client_id, { domain_txt_value: e.target.value })} /></div>
              </div>
              <Input placeholder={tr('fin.dom.notePh')} value={r.domain_admin_note || ''} onChange={e => upd(r.agency_client_id, { domain_admin_note: e.target.value })} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => save(r, 'dns_pendente')}>{tr('fin.dom.release')}</Button>
                <Button size="sm" variant="outline" onClick={() => save(r, 'ativo')}>{tr('fin.dom.markActive')}</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => save(r, 'erro')}>{tr('fin.dom.askFix')}</Button>
              </div>
            </div>
          );
        })}
        {!rows.length && <p className="text-xs text-muted-foreground">{tr('fin.dom.none')}</p>}
      </CardContent>
    </Card>
  );
};
