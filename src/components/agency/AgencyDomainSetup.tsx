import React, { useState } from 'react';
import { tr, trHtml } from '@/i18n';
import { Globe, Copy, CheckCircle2, XCircle, Loader2, Send, ExternalLink, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getNumberLocale } from '@/i18n/format';
import { dnsRecordsFor, isValidDomain, normalizeDomain } from '@/lib/custom-domain';

const statusEntry = (k: string, tone: string) => ({ tone, get label() { return tr(`agency.domain.st.${k}.label`); }, get text() { return tr(`agency.domain.st.${k}.text`); } });
const STATUS: Record<string, { label: string; tone: string; text: string }> = {
  none: statusEntry('none', 'bg-secondary text-muted-foreground'),
  solicitado: statusEntry('solicitado', 'bg-warning/15 text-warning'),
  dns_pendente: statusEntry('dns_pendente', 'bg-warning/15 text-warning'),
  ativo: statusEntry('ativo', 'bg-primary/15 text-primary'),
  erro: statusEntry('erro', 'bg-destructive/15 text-destructive'),
};

const PROVIDERS = [
  { n: 'Registro.br', k: 'registro' },
  { n: 'Hostinger', k: 'hostinger' },
  { n: 'GoDaddy', k: 'godaddy' },
  { n: 'HostGator / cPanel', k: 'cpanel' },
  { n: 'Cloudflare', k: 'cloudflare' },
];

const CopyBtn = ({ v }: { v: string }) => (
  <button type="button" title={tr('agency.domain.copy')} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
    onClick={() => { navigator.clipboard.writeText(v); toast.success(tr('agency.domain.copied')); }}><Copy size={13} /></button>
);

async function lookup(name: string, type: 'A' | 'TXT'): Promise<string[]> {
  const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`);
  const j = await r.json();
  return (j.Answer || []).filter((a: any) => a.type === (type === 'A' ? 1 : 16)).map((a: any) => String(a.data).replace(/^"|"$/g, ''));
}

interface Props { settings: any; setSettings: (s: any) => void; agencyId: string; onSaved: () => void; demo?: boolean }

/** Step-by-step custom domain setup for the partner agency. */
export const AgencyDomainSetup: React.FC<Props> = ({ settings, setSettings, agencyId, onSaved, demo }) => {
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<{ a: boolean; txt: boolean; found: string[] } | null>(null);
  const [checking, setChecking] = useState(false);
  const [openProv, setOpenProv] = useState<string | null>(null);
  const domain = settings.custom_domain || '';
  const st = STATUS[settings.domain_status || 'none'] || STATUS.none;
  const records = domain ? dnsRecordsFor(domain, settings.domain_a_ip, settings.domain_txt_value) : [];
  const showRecords = ['dns_pendente', 'ativo', 'erro'].includes(settings.domain_status);

  const request = async () => {
    const d = normalizeDomain(domain);
    if (!isValidDomain(d)) return toast.error(tr('agency.domain.invalid'));
    if (demo) return toast.info(tr('agency.domain.demo'));
    setBusy(true);
    const { error } = await supabase.from('agency_settings').upsert({ ...settings, agency_client_id: agencyId, custom_domain: d, domain_status: 'solicitado', updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return toast.error(/duplicate|unique/i.test(error.message) ? tr('agency.domain.inUse') : tr('agency.domain.sendError'));
    toast.success(tr('agency.domain.sent'));
    onSaved();
  };

  const verify = async () => {
    setChecking(true);
    try {
      const [aVals, txtVals] = await Promise.all([lookup(records[0].fqdn, 'A'), lookup(records[1].fqdn, 'TXT')]);
      setCheck({ a: aVals.includes(records[0].value), txt: !!records[1].value && txtVals.includes(records[1].value!), found: aVals });
    } catch { toast.error(tr('agency.domain.dnsError')); }
    setChecking(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Globe size={16} className="text-primary" />{tr('agency.domain.title')}
          <span className={`ml-auto text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${st.tone}`}>{st.label}</span></CardTitle>
        <p className="text-xs text-muted-foreground">{st.text}</p>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {/* Passo 1 */}
        <div className="space-y-2">
          <p className="font-medium">{tr('agency.domain.step1')}</p>
          <p className="text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: tr('agency.domain.step1Hint') }} />
          <div className="flex flex-wrap gap-2">
            <Input className="flex-1 min-w-[240px]" placeholder={tr('agency.domain.domainPh')} value={domain}
              onChange={e => setSettings({ ...settings, custom_domain: normalizeDomain(e.target.value) || null })} />
            <Button className="gap-2" disabled={busy || !domain} onClick={request}><Send size={14} />{settings.domain_status ? tr('agency.domain.update') : tr('agency.domain.request')}</Button>
          </div>
          {settings.domain_requested_at && <p className="text-[11px] text-muted-foreground">{tr('agency.domain.requestedAt', { when: new Date(settings.domain_requested_at).toLocaleString(getNumberLocale()) })}</p>}
        </div>

        {/* Passo 2 */}
        <div className="space-y-2">
          <p className="font-medium">{tr('agency.domain.step2')}</p>
          {!showRecords ? (
            <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border/60 p-3">{tr('agency.domain.recordsLater')}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40 text-muted-foreground text-left"><tr><th className="p-2">{tr('agency.domain.th.type')}</th><th className="p-2">{tr('agency.domain.th.name')}</th><th className="p-2">{tr('agency.domain.th.value')}</th><th className="p-2">TTL</th></tr></thead>
                <tbody>{records.map(r => (
                  <tr key={r.type} className="border-t border-border/50">
                    <td className="p-2 font-semibold">{r.type}</td>
                    <td className="p-2 font-mono"><span className="inline-flex items-center gap-1">{r.name}<CopyBtn v={r.name} /></span></td>
                    <td className="p-2 font-mono break-all">{r.value ? <span className="inline-flex items-center gap-1">{r.value}<CopyBtn v={r.value} /></span> : <span className="text-muted-foreground">{tr('agency.domain.waitingAdscale')}</span>}</td>
                    <td className="p-2 text-muted-foreground">{tr('agency.domain.auto')}</td>
                  </tr>))}
                </tbody>
              </table>
            </div>
          )}
          <ul className="text-[11px] text-muted-foreground list-disc pl-5 space-y-0.5">
            <li dangerouslySetInnerHTML={{ __html: tr('agency.domain.tip1') }} />
            <li dangerouslySetInnerHTML={{ __html: tr('agency.domain.tip2') }} />
            <li>{tr('agency.domain.tip3')}</li>
          </ul>
          <div className="rounded-lg border border-border/60">
            {PROVIDERS.map(p => (
              <div key={p.n} className="border-b border-border/40 last:border-0">
                <button type="button" className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-secondary/40" onClick={() => setOpenProv(openProv === p.n ? null : p.n)}>
                  <span dangerouslySetInnerHTML={{ __html: trHtml('agency.domain.howTo', { name: p.n }) }} /><ChevronDown size={13} className={openProv === p.n ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>
                {openProv === p.n && <p className="px-3 pb-3 text-[11px] text-muted-foreground">{tr(`agency.domain.prov.${p.k}`)}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Passo 3 */}
        <div className="space-y-2">
          <p className="font-medium">{tr('agency.domain.step3')}</p>
          <p className="text-xs text-muted-foreground">{tr('agency.domain.propagation')}</p>
          <Button variant="outline" className="gap-2" disabled={!showRecords || checking} onClick={verify}>{checking ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}{tr('agency.domain.checkDns')}</Button>
          {check && (
            <div className="space-y-1 text-xs">
              <p className="flex items-center gap-1.5">{check.a ? <CheckCircle2 size={14} className="text-primary" /> : <XCircle size={14} className="text-destructive" />}{check.a ? tr('agency.domain.aOk') : `${tr('agency.domain.aMissing')}${check.found.length ? ` ${tr('agency.domain.aPoints', { ips: check.found.join(', ') })}` : ''}`}</p>
              <p className="flex items-center gap-1.5">{check.txt ? <CheckCircle2 size={14} className="text-primary" /> : <XCircle size={14} className="text-destructive" />}{check.txt ? tr('agency.domain.txtOk') : tr('agency.domain.txtMissing')}</p>
              {check.a && check.txt && settings.domain_status !== 'ativo' && <p className="text-primary">{tr('agency.domain.allGood')}</p>}
            </div>
          )}
          {settings.domain_admin_note && <p className="text-xs rounded-lg border border-warning/40 bg-warning/10 p-2 text-warning">{tr('agency.domain.adminNote', { note: settings.domain_admin_note })}</p>}
        </div>

        {/* Passo 4 */}
        <div className="space-y-1">
          <p className="font-medium">{tr('agency.domain.step4')}</p>
          {domain ? <>
            <p className="text-xs">{tr('agency.panel.loginLabel')} <span className="font-mono text-primary">https://{domain}/login</span> {settings.domain_status === 'ativo' && <a href={`https://${domain}/login`} target="_blank" rel="noreferrer" className="inline-flex align-middle text-primary"><ExternalLink size={12} /></a>}</p>
            <p className="text-xs">{tr('agency.panel.signupLabel')} <span className="font-mono text-primary">https://{domain}/cadastro</span></p>
            {settings.domain_status !== 'ativo' && <p className="text-[11px] text-muted-foreground">{tr('agency.domain.linksAfter')}</p>}
          </> : <p className="text-xs text-muted-foreground">{tr('agency.domain.linksWhen')}</p>}
        </div>
      </CardContent>
    </Card>
  );
};
