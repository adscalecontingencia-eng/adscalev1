import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startOfWeek, addDays, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Download, Plus, Trash2, LogOut } from 'lucide-react';
import { AGENCY_TERMS_VERSION, getAgencyTerms, hashTerms, downloadAgencyTerms } from '@/lib/agency-terms';
import { isBelowFloor } from '@/lib/agency-tiers';

const usd = (n: number) => `US$ ${Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const weekStartOf = (d: Date) => format(startOfWeek(d, { weekStartsOn: 5 }), 'yyyy-MM-dd');

const BYOD_SQL = `-- Execute no SQL editor do seu próprio projeto
create table if not exists public.sub_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text, phone text, notes text,
  created_at timestamptz default now()
);
create table if not exists public.sub_client_tickets (
  id uuid primary key default gen_random_uuid(),
  sub_client_id uuid references public.sub_clients(id) on delete cascade,
  message text not null, created_at timestamptz default now()
);
alter table public.sub_clients enable row level security;
alter table public.sub_client_tickets enable row level security;`;

const AgencyPanel: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [agency, setAgency] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [lang, setLang] = useState<'pt' | 'en'>('pt');
  const [agree, setAgree] = useState(false);
  const [week, setWeek] = useState(weekStartOf(new Date()));
  const [summary, setSummary] = useState<any>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [platform, setPlatform] = useState<any[]>([]);
  const [credits, setCredits] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [newSub, setNewSub] = useState({ name: '', email: '', phone: '' });
  const [tierScope, setTierScope] = useState<string>('default');
  const [newTier, setNewTier] = useState({ name: '', min: '0', pct: '5', subsidy: false });
  const [newCredit, setNewCredit] = useState({ sub: '', amount: '', note: '' });

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data } = await supabase.from('clients').select('id, name, is_agency').eq('auth_user_id', authUser?.id ?? '').maybeSingle();
      setAgency(data);
      if (data?.is_agency) {
        const { data: acc } = await supabase.from('agency_terms_acceptances').select('id').eq('agency_client_id', data.id).eq('version', AGENCY_TERMS_VERSION).maybeSingle();
        setAccepted(!!acc);
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const isDemo = user?.email?.toLowerCase() === DEMO_AGENCY_EMAIL;
  const load = useCallback(async () => {
    if (!agency?.id) return;
    const id = agency.id;
    const [s, sc, as, l, t, p, c, st] = await Promise.all([
      supabase.rpc('get_agency_week_summary', { _agency: id, _week_start: week }),
      supabase.from('agency_sub_clients').select('*').eq('agency_client_id', id).order('name'),
      supabase.from('meta_ad_account_assignments').select('ad_account_id, ad_account:meta_ad_accounts(id, name, meta_account_id)').eq('client_id', id).eq('active', true),
      supabase.from('agency_sub_client_accounts').select('*').eq('agency_client_id', id),
      supabase.from('agency_tiers').select('*').eq('agency_client_id', id).order('min_weekly_spend'),
      supabase.from('agency_platform_tiers').select('*').order('min_weekly_spend'),
      supabase.from('agency_sub_client_credits').select('*').eq('agency_client_id', id).order('date', { ascending: false }),
      supabase.from('agency_settings').select('*').eq('agency_client_id', id).maybeSingle(),
    ]);
    const subList = sc.data || [];
    setSummary(isDemo ? buildDemoSummary(subList) : s.data); setSubs(subList); setAccounts((as.data || []).map((x: any) => x.ad_account).filter(Boolean));
    setLinks(l.data || []); setTiers(t.data || []); setPlatform(p.data || []); setCredits(c.data || []);
    setSettings(st.data || { agency_client_id: id, data_mode: 'adscale', primary_color: '#22c55e' });
  }, [agency?.id, week, isDemo]);

  useEffect(() => { if (accepted) load(); }, [accepted, load]);

  const terms = useMemo(() => getAgencyTerms(lang), [lang]);

  const acceptTerms = async () => {
    const content_hash = await hashTerms(terms);
    const { error } = await supabase.from('agency_terms_acceptances').insert({
      agency_client_id: agency.id, version: AGENCY_TERMS_VERSION, language: lang, content_hash, user_agent: navigator.userAgent, accepted_by: user!.id,
    });
    if (error) return toast.error('Não foi possível registrar o aceite.');
    toast.success('Termo aceito.'); setAccepted(true);
  };

  const addSub = async () => {
    if (!newSub.name.trim()) return;
    const { error } = await supabase.from('agency_sub_clients').insert({ agency_client_id: agency.id, ...newSub });
    if (error) return toast.error(error.message);
    setNewSub({ name: '', email: '', phone: '' }); load();
  };
  const delSub = async (id: string) => { if (!confirm('Excluir este cliente?')) return; await supabase.from('agency_sub_clients').delete().eq('id', id); load(); };

  const assign = async (accountId: string, subId: string) => {
    await supabase.from('agency_sub_client_accounts').delete().eq('ad_account_id', accountId).eq('agency_client_id', agency.id);
    if (subId !== 'none') {
      const { error } = await supabase.from('agency_sub_client_accounts').insert({ agency_client_id: agency.id, sub_client_id: subId, ad_account_id: accountId });
      if (error) return toast.error('Não foi possível atribuir.');
    }
    toast.success('Atribuição salva.'); load();
  };

  const platformPcts = platform.map(p => Number(p.adscale_pct));
  const tierPct = Number(newTier.pct.replace(',', '.'));
  const belowFloor = isBelowFloor(tierPct, platformPcts, newTier.subsidy);

  const addTier = async () => {
    if (!newTier.name.trim() || isNaN(tierPct)) return;
    if (belowFloor) return toast.error('Taxa abaixo do custo AD SCALE. Marque subsídio para confirmar.');
    const { error } = await supabase.from('agency_tiers').insert({
      agency_client_id: agency.id, sub_client_id: tierScope === 'default' ? null : tierScope,
      name: newTier.name, min_weekly_spend: Number(newTier.min) || 0, total_pct: tierPct, allow_subsidy: newTier.subsidy,
    });
    if (error) return toast.error(error.message);
    setNewTier({ name: '', min: '0', pct: '5', subsidy: false }); load();
  };
  const delTier = async (id: string) => { await supabase.from('agency_tiers').delete().eq('id', id); load(); };

  const addCredit = async () => {
    const amount = Number(newCredit.amount.replace(',', '.'));
    if (!newCredit.sub || !amount) return;
    const { error } = await supabase.from('agency_sub_client_credits').insert({ agency_client_id: agency.id, sub_client_id: newCredit.sub, amount, note: newCredit.note || null });
    if (error) return toast.error(error.message);
    setNewCredit({ sub: '', amount: '', note: '' }); load();
  };

  const saveSettings = async () => {
    const { error } = await supabase.from('agency_settings').upsert({ ...settings, agency_client_id: agency.id, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success('Configurações salvas.');
  };

  const testByod = async () => {
    if (!settings.byod_url || !settings.byod_anon_key) return toast.error('Preencha URL e chave pública.');
    try {
      const r = await fetch(`${settings.byod_url.replace(/\/$/, '')}/rest/v1/sub_clients?select=id&limit=1`, { headers: { apikey: settings.byod_anon_key, Authorization: `Bearer ${settings.byod_anon_key}` } });
      if (r.ok || r.status === 401 || r.status === 403) { toast.success('Conexão OK — tabelas encontradas.'); setSettings({ ...settings, byod_initialized_at: new Date().toISOString() }); }
      else if (r.status === 404) toast.error('Conectou, mas as tabelas ainda não existem. Rode o script.');
      else toast.error(`Falha na conexão (${r.status}).`);
    } catch { toast.error('Não foi possível alcançar o banco informado.'); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;
  if (!agency?.is_agency) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-muted-foreground">Sua conta ainda não está habilitada como Agência Parceira.</p>
      <Button variant="outline" onClick={() => navigate('/client-dashboard')}>Voltar ao painel</Button>
    </div>
  );

  if (!accepted) return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader><CardTitle>Termo de Agência Parceira & Whitelabel</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button size="sm" variant={lang === 'pt' ? 'default' : 'outline'} onClick={() => setLang('pt')}>Português</Button>
            <Button size="sm" variant={lang === 'en' ? 'default' : 'outline'} onClick={() => setLang('en')}>English</Button>
            <Button size="sm" variant="ghost" className="ml-auto gap-2" onClick={() => downloadAgencyTerms(lang)}><Download size={14} />Baixar</Button>
          </div>
          <pre className="whitespace-pre-wrap text-xs leading-relaxed max-h-[55vh] overflow-y-auto rounded-md border border-border bg-secondary/40 p-4 font-sans">{terms}</pre>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={agree} onCheckedChange={v => setAgree(!!v)} />
            <span>Li e aceito integralmente o Termo de Agência Parceira (versão {AGENCY_TERMS_VERSION}).</span>
          </label>
          <Button disabled={!agree} onClick={acceptTerms} className="w-full">Aceitar e continuar</Button>
        </CardContent>
      </Card>
    </div>
  );

  const pt = summary?.platform_tier; const nt = summary?.next_tier;
  const progress = nt ? Math.min(100, ((summary.total_spend - (pt?.min || 0)) / (nt.min - (pt?.min || 0))) * 100) : 100;
  const linkOf = (accId: string) => links.find(l => l.ad_account_id === accId)?.sub_client_id ?? 'none';
  const creditBalance = (subId: string) => {
    const paid = credits.filter(c => c.sub_client_id === subId && c.status === 'confirmado').reduce((a, c) => a + Number(c.amount), 0);
    const row = summary?.sub_clients?.find((r: any) => r.sub_client_id === subId);
    return { paid, weekUse: row ? Number(row.spend) + Number(row.client_fee) : 0 };
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 h-14 border-b border-border/60 bg-background/70 backdrop-blur-xl flex items-center px-4 gap-3">
        <Button size="sm" variant="ghost" onClick={() => navigate('/client-dashboard')} className="gap-2"><ArrowLeft size={14} />Painel</Button>
        <h1 className="font-display text-sm font-semibold"><span translate="no" className="notranslate">{settings.brand_name || agency.name}</span> · Painel da Agência</h1>
        <Button size="sm" variant="ghost" className="ml-auto gap-2" onClick={async () => { await logout(); navigate('/login'); }}><LogOut size={14} />Sair</Button>
      </header>
      <div className="p-4 lg:p-6 max-w-6xl mx-auto">
        <Tabs defaultValue="resumo" className="space-y-5">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="resumo">Resumo & Repasse</TabsTrigger>
            <TabsTrigger value="clientes">Clientes & Contas</TabsTrigger>
            <TabsTrigger value="tiers">Tiers & Taxas</TabsTrigger>
            <TabsTrigger value="creditos">Créditos</TabsTrigger>
            <TabsTrigger value="marca">Marca & Dados</TabsTrigger>
            <TabsTrigger value="juridico">Jurídico</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Button size="sm" variant="outline" onClick={() => setWeek(format(addDays(new Date(week + 'T12:00:00'), -7), 'yyyy-MM-dd'))}>‹</Button>
              <span>Semana {format(new Date(week + 'T12:00:00'), 'dd/MM')} a {format(addDays(new Date(week + 'T12:00:00'), 6), 'dd/MM')} (sexta a quinta)</span>
              <Button size="sm" variant="outline" onClick={() => setWeek(format(addDays(new Date(week + 'T12:00:00'), 7), 'yyyy-MM-dd'))}>›</Button>
            </div>
            {isDemo && <div className="rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-xs text-primary">Conta de demonstração: os gastos e comissões abaixo são simulados, só para apresentação.</div>}
            <div className="grid sm:grid-cols-3 gap-4">
              <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Gasto total da agência</p><p className="text-2xl font-bold">{usd(summary?.total_spend)}</p></CardContent></Card>
              <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Seu nível AD SCALE</p><p className="text-2xl font-bold">{pt?.name ?? '—'}</p><p className="text-xs text-primary">Taxa AD SCALE {pt?.adscale_pct ?? 0}%</p></CardContent></Card>
              <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Repasse devido à AD SCALE</p><p className="text-2xl font-bold text-primary">{usd(summary?.adscale_due)}</p><p className="text-xs text-muted-foreground">Pago na sexta seguinte ao fechamento</p></CardContent></Card>
            </div>
            {nt && <Card><CardContent className="pt-6 space-y-2"><p className="text-sm">Faltam <b>{usd(nt.remaining)}</b> nesta semana para sua taxa AD SCALE cair para <b>{nt.adscale_pct}%</b> ({nt.name}).</p><Progress value={progress} /></CardContent></Card>}
            <Card><CardHeader><CardTitle className="text-base">Por cliente</CardTitle></CardHeader><CardContent className="overflow-x-auto">
              <table className="w-full text-sm"><thead className="text-xs text-muted-foreground text-left"><tr><th className="py-2">Cliente</th><th>Gasto</th><th>Tier</th><th>Taxa</th><th>Cobrado</th><th>AD SCALE</th><th>Sua margem</th></tr></thead>
                <tbody>{(summary?.sub_clients || []).map((r: any) => (
                  <tr key={r.sub_client_id} className="border-t border-border/50"><td className="py-2">{r.name}</td><td>{usd(r.spend)}</td><td>{r.tier_name ?? 'Padrão'}</td><td>{r.client_pct}%</td><td>{usd(r.client_fee)}</td><td>{usd(r.adscale_fee)}</td><td className={r.agency_margin < 0 ? 'text-destructive' : 'text-primary'}>{usd(r.agency_margin)}</td></tr>
                ))}{!summary?.sub_clients?.length && <tr><td colSpan={7} className="py-4 text-muted-foreground">Cadastre clientes e atribua contas para ver o detalhamento.</td></tr>}</tbody></table>
              <p className="text-xs text-muted-foreground mt-3">O repasse à AD SCALE é calculado sobre o gasto total de todas as contas atribuídas à agência, inclusive as que não estão com nenhum cliente.</p>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="clientes" className="space-y-4">
            <Card><CardHeader><CardTitle className="text-base">Novo cliente</CardTitle></CardHeader><CardContent className="grid sm:grid-cols-4 gap-2">
              <Input placeholder="Nome" value={newSub.name} onChange={e => setNewSub({ ...newSub, name: e.target.value })} />
              <Input placeholder="E-mail" value={newSub.email} onChange={e => setNewSub({ ...newSub, email: e.target.value })} />
              <Input placeholder="WhatsApp" value={newSub.phone} onChange={e => setNewSub({ ...newSub, phone: e.target.value })} />
              <Button onClick={addSub} className="gap-2"><Plus size={14} />Adicionar</Button>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Clientes ({subs.length})</CardTitle></CardHeader><CardContent className="space-y-2">
              {subs.map(s => <div key={s.id} className="flex items-center gap-3 border-b border-border/40 pb-2 text-sm"><span className="flex-1">{s.name}</span><span className="text-muted-foreground text-xs">{s.email}</span><Button size="icon" variant="ghost" onClick={() => delSub(s.id)}><Trash2 size={14} /></Button></div>)}
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Contas de anúncio da agência ({accounts.length})</CardTitle></CardHeader><CardContent className="space-y-2">
              {accounts.map(a => <div key={a.id} className="flex items-center gap-3 text-sm border-b border-border/40 pb-2">
                <div className="flex-1"><p>{a.name}</p><p className="text-xs text-muted-foreground">{a.meta_account_id}</p></div>
                <Select value={linkOf(a.id)} onValueChange={v => assign(a.id, v)}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Sem cliente</SelectItem>{subs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>)}
              {!accounts.length && <p className="text-sm text-muted-foreground">Nenhuma conta atribuída à agência ainda.</p>}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="tiers" className="space-y-4">
            <Card><CardHeader><CardTitle className="text-base">Seu custo AD SCALE por volume semanal</CardTitle></CardHeader><CardContent className="grid sm:grid-cols-4 gap-2 text-sm">
              {platform.map(p => <div key={p.id} className="rounded-md border border-border p-3"><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">a partir de {usd(p.min_weekly_spend)}</p><p className="text-primary">{p.adscale_pct}%</p></div>)}
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Criar tier para seus clientes</CardTitle></CardHeader><CardContent className="space-y-3">
              <div className="grid sm:grid-cols-5 gap-2">
                <Select value={tierScope} onValueChange={setTierScope}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">Padrão (todos)</SelectItem>{subs.map(s => <SelectItem key={s.id} value={s.id}>Só: {s.name}</SelectItem>)}</SelectContent></Select>
                <Input placeholder="Nome (ex: Prata)" value={newTier.name} onChange={e => setNewTier({ ...newTier, name: e.target.value })} />
                <Input placeholder="Meta semanal US$" type="number" value={newTier.min} onChange={e => setNewTier({ ...newTier, min: e.target.value })} />
                <Input placeholder="Taxa %" value={newTier.pct} onChange={e => setNewTier({ ...newTier, pct: e.target.value })} />
                <Button onClick={addTier} className="gap-2"><Plus size={14} />Criar</Button>
              </div>
              {isBelowFloor(tierPct, platformPcts, false) && <label className="flex items-center gap-2 text-xs text-destructive"><Checkbox checked={newTier.subsidy} onCheckedChange={v => setNewTier({ ...newTier, subsidy: !!v })} />Essa taxa é menor que o custo AD SCALE. Confirmo que vou subsidiar a diferença.</label>}
              <p className="text-xs text-muted-foreground">Se um cliente tiver tiers próprios, eles substituem os padrão. Sem nenhum tier, usamos a taxa sugerida (custo AD SCALE + margem sugerida).</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6 space-y-2 text-sm">
              {tiers.map(t => <div key={t.id} className="flex items-center gap-3 border-b border-border/40 pb-2">
                <span className="w-40 text-xs text-muted-foreground">{t.sub_client_id ? subs.find(s => s.id === t.sub_client_id)?.name : 'Padrão'}</span>
                <span className="flex-1">{t.name}</span><span>≥ {usd(t.min_weekly_spend)}</span><span className="w-16 text-primary">{t.total_pct}%</span>
                <Button size="icon" variant="ghost" onClick={() => delTier(t.id)}><Trash2 size={14} /></Button></div>)}
              {!tiers.length && <p className="text-muted-foreground">Nenhum tier criado.</p>}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="creditos" className="space-y-4">
            <Card><CardHeader><CardTitle className="text-base">Registrar crédito recebido do cliente</CardTitle></CardHeader><CardContent className="grid sm:grid-cols-4 gap-2">
              <Select value={newCredit.sub} onValueChange={v => setNewCredit({ ...newCredit, sub: v })}><SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger><SelectContent>{subs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
              <Input placeholder="Valor US$" value={newCredit.amount} onChange={e => setNewCredit({ ...newCredit, amount: e.target.value })} />
              <Input placeholder="Observação" value={newCredit.note} onChange={e => setNewCredit({ ...newCredit, note: e.target.value })} />
              <Button onClick={addCredit}>Registrar</Button>
            </CardContent></Card>
            <Card><CardContent className="pt-6 text-sm space-y-2">
              {subs.map(s => { const b = creditBalance(s.id); return <div key={s.id} className="flex gap-3 border-b border-border/40 pb-2"><span className="flex-1">{s.name}</span><span>Créditos: {usd(b.paid)}</span><span className="text-muted-foreground">Consumo da semana: {usd(b.weekUse)}</span></div>; })}
              <p className="text-xs text-muted-foreground pt-2">O crédito é pago pelo cliente a você. A parte da taxa AD SCALE sobre o consumo entra na sua fatura semanal.</p>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="marca" className="space-y-4">
            <Card><CardHeader><CardTitle className="text-base">Identidade visual</CardTitle></CardHeader><CardContent className="grid sm:grid-cols-2 gap-3">
              <div><Label>Nome da marca</Label><Input value={settings.brand_name || ''} onChange={e => setSettings({ ...settings, brand_name: e.target.value })} /></div>
              <div><Label>URL do logo</Label><Input value={settings.logo_url || ''} onChange={e => setSettings({ ...settings, logo_url: e.target.value })} /></div>
              <div><Label>Cor principal</Label><Input type="color" value={settings.primary_color || '#22c55e'} onChange={e => setSettings({ ...settings, primary_color: e.target.value })} /></div>
              <div><Label>Domínio personalizado</Label><Input placeholder="painel.suaagencia.com" value={settings.custom_domain || ''} onChange={e => setSettings({ ...settings, custom_domain: e.target.value })} /></div>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Banco de dados & privacidade</CardTitle></CardHeader><CardContent className="space-y-3">
              <Select value={settings.data_mode || 'adscale'} onValueChange={v => setSettings({ ...settings, data_mode: v })}>
                <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="adscale">Banco padrão AD SCALE (isolado)</SelectItem><SelectItem value="byod">Banco próprio (privacidade máxima)</SelectItem></SelectContent>
              </Select>
              {settings.data_mode === 'byod' && <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><Label>URL do projeto</Label><Input placeholder="https://xxxx.supabase.co" value={settings.byod_url || ''} onChange={e => setSettings({ ...settings, byod_url: e.target.value })} /></div>
                  <div><Label>Chave pública (anon)</Label><Input value={settings.byod_anon_key || ''} onChange={e => setSettings({ ...settings, byod_anon_key: e.target.value })} /></div>
                </div>
                <p className="text-xs text-muted-foreground">1) Crie um projeto gratuito. 2) Rode o script abaixo no editor SQL dele. 3) Cole URL e chave e teste.</p>
                <pre className="text-[11px] bg-secondary/40 border border-border rounded-md p-3 overflow-x-auto">{BYOD_SQL}</pre>
                <div className="flex gap-2"><Button variant="outline" onClick={() => { navigator.clipboard.writeText(BYOD_SQL); toast.success('Script copiado.'); }}>Copiar script</Button><Button variant="outline" onClick={testByod}>Testar conexão</Button></div>
              </>}
            </CardContent></Card>
            <Button onClick={saveSettings}>Salvar</Button>
          </TabsContent>

          <TabsContent value="juridico">
            <Card><CardContent className="pt-6 space-y-3 text-sm">
              <p>Termo de Agência Parceira aceito — versão {AGENCY_TERMS_VERSION}.</p>
              <div className="flex gap-2"><Button variant="outline" className="gap-2" onClick={() => downloadAgencyTerms('pt')}><Download size={14} />Português</Button><Button variant="outline" className="gap-2" onClick={() => downloadAgencyTerms('en')}><Download size={14} />English</Button></div>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AgencyPanel;
