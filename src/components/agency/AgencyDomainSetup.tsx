import React, { useState } from 'react';
import { Globe, Copy, CheckCircle2, XCircle, Loader2, Send, ExternalLink, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { dnsRecordsFor, isValidDomain, normalizeDomain } from '@/lib/custom-domain';

const STATUS: Record<string, { label: string; tone: string; text: string }> = {
  none: { label: 'Não configurado', tone: 'bg-secondary text-muted-foreground', text: 'Escolha o endereço e solicite a ativação.' },
  solicitado: { label: 'Solicitado', tone: 'bg-warning/15 text-warning', text: 'Recebemos seu pedido. Em até 1 dia útil liberamos os registros de DNS abaixo.' },
  dns_pendente: { label: 'Aguardando seu DNS', tone: 'bg-warning/15 text-warning', text: 'Crie os 2 registros abaixo no seu provedor de domínio e clique em "Verificar DNS".' },
  ativo: { label: 'Ativo', tone: 'bg-primary/15 text-primary', text: 'Seu domínio está no ar com cadeado de segurança (https).' },
  erro: { label: 'Precisa de ajuste', tone: 'bg-destructive/15 text-destructive', text: 'Encontramos um problema. Veja a observação abaixo.' },
};

const PROVIDERS = [
  { n: 'Registro.br', s: 'Entre em registro.br → seu domínio → "DNS" → "Editar zona" (ou "Configurar endereçamento" → modo avançado). Clique em "Nova entrada" para cada registro e salve.' },
  { n: 'Hostinger', s: 'hPanel → Domínios → seu domínio → "DNS / Nameservers" → "Gerenciar registros DNS". Escolha o tipo (A ou TXT), preencha Nome e Valor e clique em "Adicionar registro".' },
  { n: 'GoDaddy', s: 'Meus Produtos → seu domínio → "DNS" → "Adicionar novo registro". Em "Nome" use exatamente o valor da coluna Nome.' },
  { n: 'HostGator / cPanel', s: 'cPanel → "Zone Editor" (Editor de zona) → "Gerenciar" no domínio → "+ Adicionar registro".' },
  { n: 'Cloudflare', s: 'Painel → seu site → DNS → Records → "Add record". No registro A deixe a nuvem CINZA ("DNS only"), não laranja — senão o certificado de segurança não é emitido.' },
];

const CopyBtn = ({ v }: { v: string }) => (
  <button type="button" title="Copiar" className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
    onClick={() => { navigator.clipboard.writeText(v); toast.success('Copiado.'); }}><Copy size={13} /></button>
);

async function lookup(name: string, type: 'A' | 'TXT'): Promise<string[]> {
  const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`);
  const j = await r.json();
  return (j.Answer || []).filter((a: any) => a.type === (type === 'A' ? 1 : 16)).map((a: any) => String(a.data).replace(/^"|"$/g, ''));
}

interface Props { settings: any; setSettings: (s: any) => void; agencyId: string; onSaved: () => void }

/** Step-by-step custom domain setup for the partner agency. */
export const AgencyDomainSetup: React.FC<Props> = ({ settings, setSettings, agencyId, onSaved }) => {
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
    if (!isValidDomain(d)) return toast.error('Digite um domínio válido, ex.: painel.suaagencia.com.br');
    setBusy(true);
    const { error } = await supabase.from('agency_settings').upsert({ ...settings, agency_client_id: agencyId, custom_domain: d, domain_status: 'solicitado', updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return toast.error(/duplicate|unique/i.test(error.message) ? 'Este domínio já está em uso por outra agência.' : 'Não foi possível enviar o pedido.');
    toast.success('Pedido enviado à AD SCALE.');
    onSaved();
  };

  const verify = async () => {
    setChecking(true);
    try {
      const [aVals, txtVals] = await Promise.all([lookup(records[0].fqdn, 'A'), lookup(records[1].fqdn, 'TXT')]);
      setCheck({ a: aVals.includes(records[0].value), txt: !!records[1].value && txtVals.includes(records[1].value!), found: aVals });
    } catch { toast.error('Não foi possível consultar o DNS agora. Tente de novo.'); }
    setChecking(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Globe size={16} className="text-primary" />Domínio personalizado
          <span className={`ml-auto text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${st.tone}`}>{st.label}</span></CardTitle>
        <p className="text-xs text-muted-foreground">{st.text}</p>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {/* Passo 1 */}
        <div className="space-y-2">
          <p className="font-medium">1. Escolha o endereço do seu painel</p>
          <p className="text-xs text-muted-foreground">Use um <b>subdomínio</b> do seu site, como <span className="font-mono text-primary">painel.suaagencia.com.br</span> ou <span className="font-mono text-primary">clientes.suaagencia.com</span>. Assim o site principal da sua agência continua funcionando normalmente.</p>
          <div className="flex flex-wrap gap-2">
            <Input className="flex-1 min-w-[240px]" placeholder="painel.suaagencia.com.br" value={domain}
              onChange={e => setSettings({ ...settings, custom_domain: normalizeDomain(e.target.value) || null })} />
            <Button className="gap-2" disabled={busy || !domain} onClick={request}><Send size={14} />{settings.domain_status ? 'Atualizar pedido' : 'Solicitar ativação'}</Button>
          </div>
          {settings.domain_requested_at && <p className="text-[11px] text-muted-foreground">Pedido enviado em {new Date(settings.domain_requested_at).toLocaleString('pt-BR')}. Trocar o endereço reinicia o processo.</p>}
        </div>

        {/* Passo 2 */}
        <div className="space-y-2">
          <p className="font-medium">2. Crie estes registros no provedor do seu domínio</p>
          {!showRecords ? (
            <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border/60 p-3">Os registros aparecem aqui assim que a AD SCALE liberar o seu pedido (você recebe o código de verificação exclusivo do seu domínio).</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40 text-muted-foreground text-left"><tr><th className="p-2">Tipo</th><th className="p-2">Nome / Host</th><th className="p-2">Valor / Aponta para</th><th className="p-2">TTL</th></tr></thead>
                <tbody>{records.map(r => (
                  <tr key={r.type} className="border-t border-border/50">
                    <td className="p-2 font-semibold">{r.type}</td>
                    <td className="p-2 font-mono"><span className="inline-flex items-center gap-1">{r.name}<CopyBtn v={r.name} /></span></td>
                    <td className="p-2 font-mono break-all">{r.value ? <span className="inline-flex items-center gap-1">{r.value}<CopyBtn v={r.value} /></span> : <span className="text-muted-foreground">aguardando AD SCALE</span>}</td>
                    <td className="p-2 text-muted-foreground">Automático / 3600</td>
                  </tr>))}
                </tbody>
              </table>
            </div>
          )}
          <ul className="text-[11px] text-muted-foreground list-disc pl-5 space-y-0.5">
            <li>Se o provedor completar o nome sozinho, digite só o que está na coluna <b>Nome</b> (ex.: <span className="font-mono">painel</span>), sem o resto do domínio.</li>
            <li>Apague registros antigos <b>A</b>, <b>AAAA</b> ou <b>CNAME</b> que já existam com o mesmo nome — eles impedem a ativação.</li>
            <li>Se usar Cloudflare, deixe o registro A como "DNS only" (nuvem cinza).</li>
          </ul>
          <div className="rounded-lg border border-border/60">
            {PROVIDERS.map(p => (
              <div key={p.n} className="border-b border-border/40 last:border-0">
                <button type="button" className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-secondary/40" onClick={() => setOpenProv(openProv === p.n ? null : p.n)}>
                  <span>Como fazer no <b>{p.n}</b></span><ChevronDown size={13} className={openProv === p.n ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>
                {openProv === p.n && <p className="px-3 pb-3 text-[11px] text-muted-foreground">{p.s}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Passo 3 */}
        <div className="space-y-2">
          <p className="font-medium">3. Verifique e aguarde a ativação</p>
          <p className="text-xs text-muted-foreground">A propagação do DNS costuma levar de alguns minutos a algumas horas (até 72h). Quando os dois registros estiverem certos, o cadeado de segurança é emitido automaticamente.</p>
          <Button variant="outline" className="gap-2" disabled={!showRecords || checking} onClick={verify}>{checking ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}Verificar DNS</Button>
          {check && (
            <div className="space-y-1 text-xs">
              <p className="flex items-center gap-1.5">{check.a ? <CheckCircle2 size={14} className="text-primary" /> : <XCircle size={14} className="text-destructive" />}Registro A {check.a ? 'correto' : `ainda não encontrado${check.found.length ? ` (hoje aponta para ${check.found.join(', ')})` : ''}`}</p>
              <p className="flex items-center gap-1.5">{check.txt ? <CheckCircle2 size={14} className="text-primary" /> : <XCircle size={14} className="text-destructive" />}Registro TXT {check.txt ? 'correto' : 'ainda não encontrado'}</p>
              {check.a && check.txt && settings.domain_status !== 'ativo' && <p className="text-primary">Tudo certo do seu lado! A AD SCALE conclui a ativação em breve.</p>}
            </div>
          )}
          {settings.domain_admin_note && <p className="text-xs rounded-lg border border-warning/40 bg-warning/10 p-2 text-warning">Observação da AD SCALE: {settings.domain_admin_note}</p>}
        </div>

        {/* Passo 4 */}
        <div className="space-y-1">
          <p className="font-medium">4. Divulgue para seus clientes</p>
          {domain ? <>
            <p className="text-xs">Login: <span className="font-mono text-primary">https://{domain}/login</span> {settings.domain_status === 'ativo' && <a href={`https://${domain}/login`} target="_blank" rel="noreferrer" className="inline-flex align-middle text-primary"><ExternalLink size={12} /></a>}</p>
            <p className="text-xs">Cadastro: <span className="font-mono text-primary">https://{domain}/cadastro</span></p>
            {settings.domain_status !== 'ativo' && <p className="text-[11px] text-muted-foreground">Esses links só funcionam depois que o status ficar "Ativo". Até lá, use o link com o identificador da agência.</p>}
          </> : <p className="text-xs text-muted-foreground">Os links aparecem aqui quando você escolher o domínio.</p>}
        </div>
      </CardContent>
    </Card>
  );
};
