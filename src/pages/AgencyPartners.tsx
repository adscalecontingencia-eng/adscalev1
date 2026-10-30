import React, { useCallback, useEffect, useState } from 'react';
import { startOfWeek, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const usd = (n: number) => `US$ ${Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const AgencyPartners: React.FC = () => {
  const week = format(startOfWeek(new Date(), { weekStartsOn: 5 }), 'yyyy-MM-dd');
  const [clients, setClients] = useState<any[]>([]);
  const [overview, setOverview] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const [c, o, t] = await Promise.all([
      supabase.from('clients').select('id, name, email, is_agency').order('name'),
      supabase.rpc('get_agencies_overview', { _week_start: week }),
      supabase.from('agency_platform_tiers').select('*').order('min_weekly_spend'),
    ]);
    setClients(c.data || []); setOverview((o.data as any[]) || []); setTiers(t.data || []);
  }, [week]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (id: string, v: boolean) => {
    const { error } = await supabase.from('clients').update({ is_agency: v, agency_enabled_at: v ? new Date().toISOString() : null }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success(v ? 'Cliente promovido a Agência. Ele verá o termo no próximo acesso.' : 'Modo agência desativado.');
    load();
  };

  const saveTier = async (t: any) => {
    const { error } = await supabase.from('agency_platform_tiers').update({
      name: t.name, min_weekly_spend: Number(t.min_weekly_spend), adscale_pct: Number(t.adscale_pct), suggested_agency_pct: Number(t.suggested_agency_pct), updated_at: new Date().toISOString(),
    }).eq('id', t.id);
    if (error) return toast.error(error.message);
    toast.success('Tier salvo.');
  };

  const totalDue = overview.reduce((a, o) => a + Number(o.summary?.adscale_due || 0), 0);

  return (
    <div className="space-y-5">
      <Card><CardHeader><CardTitle className="text-base">Repasse das agências — semana atual · total {usd(totalDue)}</CardTitle></CardHeader><CardContent className="overflow-x-auto">
        <table className="w-full text-sm"><thead className="text-xs text-muted-foreground text-left"><tr><th className="py-2">Agência</th><th>Termo</th><th>Clientes</th><th>Gasto</th><th>Tier</th><th>A receber</th></tr></thead>
          <tbody>{overview.map(o => <tr key={o.id} className="border-t border-border/50"><td className="py-2">{o.name}</td><td>{o.terms_accepted_at ? 'Aceito' : <span className="text-destructive">Pendente</span>}</td><td>{o.sub_clients}</td><td>{usd(o.summary?.total_spend)}</td><td>{o.summary?.platform_tier?.name} ({o.summary?.platform_tier?.adscale_pct}%)</td><td className="text-primary font-semibold">{usd(o.summary?.adscale_due)}</td></tr>)}
            {!overview.length && <tr><td colSpan={6} className="py-4 text-muted-foreground">Nenhuma agência ativa.</td></tr>}</tbody></table>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">Tiers AD SCALE para agências</CardTitle></CardHeader><CardContent className="space-y-2">
        <div className="grid grid-cols-5 gap-2 text-xs text-muted-foreground"><span>Nome</span><span>Gasto semanal mín.</span><span>Taxa AD SCALE %</span><span>Margem sugerida %</span><span /></div>
        {tiers.map((t, i) => <div key={t.id} className="grid grid-cols-5 gap-2">
          {(['name', 'min_weekly_spend', 'adscale_pct', 'suggested_agency_pct'] as const).map(k =>
            <Input key={k} value={t[k]} onChange={e => setTiers(tiers.map((x, j) => j === i ? { ...x, [k]: e.target.value } : x))} />)}
          <Button variant="outline" onClick={() => saveTier(t)}>Salvar</Button>
        </div>)}
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">Habilitar modo agência</CardTitle></CardHeader><CardContent className="space-y-2">
        <Input placeholder="Buscar cliente" value={q} onChange={e => setQ(e.target.value)} className="max-w-sm" />
        {clients.filter(c => !q || `${c.name} ${c.email}`.toLowerCase().includes(q.toLowerCase())).slice(0, 60).map(c =>
          <div key={c.id} className="flex items-center gap-3 border-b border-border/40 pb-2 text-sm"><span className="flex-1">{c.name}</span><span className="text-xs text-muted-foreground">{c.email}</span><Switch checked={!!c.is_agency} onCheckedChange={v => toggle(c.id, v)} /></div>)}
      </CardContent></Card>
    </div>
  );
};

export default AgencyPartners;
