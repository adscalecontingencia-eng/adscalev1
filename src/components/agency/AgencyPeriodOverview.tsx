import React, { useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const usd = (n: number) => `US$ ${Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const PRESETS = [
  { v: 'hoje', l: 'Hoje' }, { v: 'ontem', l: 'Ontem' }, { v: '7d', l: 'Últimos 7 dias' },
  { v: '30d', l: 'Últimos 30 dias' }, { v: 'custom', l: 'Personalizado' },
] as const;

type Props = { accounts: any[]; subs: any[]; linkOf: (accId: string) => string; summary: any; isDemo: boolean };

/** Gasto e comissões da agência por período livre (estimativa com as taxas atuais). */
export const AgencyPeriodOverview: React.FC<Props> = ({ accounts, subs, linkOf, summary, isDemo }) => {
  const [preset, setPreset] = useState<string>('7d');
  const [from, setFrom] = useState(iso(subDays(new Date(), 6)));
  const [to, setTo] = useState(iso(new Date()));
  const [rows, setRows] = useState<{ ad_account_id: string; date: string; spend: number }[]>([]);

  const range = useMemo(() => {
    const t = new Date();
    if (preset === 'hoje') return { s: iso(t), e: iso(t) };
    if (preset === 'ontem') return { s: iso(subDays(t, 1)), e: iso(subDays(t, 1)) };
    if (preset === '7d') return { s: iso(subDays(t, 6)), e: iso(t) };
    if (preset === '30d') return { s: iso(subDays(t, 29)), e: iso(t) };
    return from <= to ? { s: from, e: to } : { s: to, e: from };
  }, [preset, from, to]);

  useEffect(() => {
    const ids = accounts.map(a => a.id);
    if (!ids.length) { setRows([]); return; }
    if (isDemo) {
      const out: any[] = [];
      accounts.forEach((a, ai) => {
        const daily = (a.week_spend || 0) / 7;
        for (let d = 0; d < 90; d++) {
          const date = iso(subDays(new Date(), d));
          if (date < range.s || date > range.e) continue;
          out.push({ ad_account_id: a.id, date, spend: daily * (0.75 + 0.5 * Math.abs(Math.sin((d + 1) * (ai + 2) * 0.7))) });
        }
      });
      setRows(out); return;
    }
    (async () => {
      const all: any[] = [];
      for (let p = 0; ; p += 1000) {
        const { data } = await supabase.from('meta_ad_insights').select('ad_account_id, date, spend').in('ad_account_id', ids).gte('date', range.s).lte('date', range.e).range(p, p + 999);
        all.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      setRows(all.map(r => ({ ...r, spend: Number(r.spend || 0) })));
    })();
  }, [accounts, range, isDemo]);

  const adPct = Number(summary?.platform_tier?.adscale_pct || 0);
  const bySub = subs.map(s => {
    const spend = rows.filter(r => linkOf(r.ad_account_id) === s.id).reduce((t, r) => t + r.spend, 0);
    const pct = Number(summary?.sub_clients?.find((x: any) => x.sub_client_id === s.id)?.client_pct || 0);
    const fee = spend * pct / 100, ad = spend * adPct / 100;
    return { s, spend, pct, fee, ad, margin: fee - ad };
  });
  const total = rows.reduce((t, r) => t + r.spend, 0);
  const totalFee = bySub.reduce((t, r) => t + r.fee, 0);
  const totalAd = total * adPct / 100;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map(p => (
          <button key={p.v} onClick={() => setPreset(p.v)} className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${preset === p.v ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 text-muted-foreground hover:text-foreground'}`}>{p.l}</button>
        ))}
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <Input type="date" className="h-8 w-40" value={from} onChange={e => setFrom(e.target.value)} />
            <span className="text-xs text-muted-foreground">até</span>
            <Input type="date" className="h-8 w-40" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{format(new Date(range.s + 'T12:00:00'), 'dd/MM/yyyy')} a {format(new Date(range.e + 'T12:00:00'), 'dd/MM/yyyy')}</span>
      </div>
      <div className="grid sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Gasto no período</p><p className="text-2xl font-bold">{usd(total)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Comissão dos clientes</p><p className="text-2xl font-bold">{usd(totalFee)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Parte AD SCALE ({adPct}%)</p><p className="text-2xl font-bold text-primary">{usd(totalAd)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Sua margem</p><p className={`text-2xl font-bold ${totalFee - totalAd < 0 ? 'text-destructive' : 'text-primary'}`}>{usd(totalFee - totalAd)}</p></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle className="text-base">Por cliente no período</CardTitle></CardHeader><CardContent className="overflow-x-auto">
        <table className="w-full text-sm"><thead className="text-xs text-muted-foreground text-left"><tr><th className="py-2">Cliente</th><th>Gasto</th><th>Taxa</th><th>Cobrado</th><th>AD SCALE</th><th>Sua margem</th></tr></thead>
          <tbody>{bySub.map(r => (
            <tr key={r.s.id} className="border-t border-border/50"><td className="py-2">{r.s.name}</td><td>{usd(r.spend)}</td><td>{r.pct}%</td><td>{usd(r.fee)}</td><td>{usd(r.ad)}</td><td className={r.margin < 0 ? 'text-destructive' : 'text-primary'}>{usd(r.margin)}</td></tr>
          ))}{!bySub.length && <tr><td colSpan={6} className="py-4 text-muted-foreground">Cadastre clientes e atribua contas para ver o detalhamento.</td></tr>}</tbody></table>
        <p className="text-xs text-muted-foreground mt-3">Valores do período são uma estimativa com as taxas atuais. A cobrança oficial continua sendo o fechamento semanal (sexta a quinta), abaixo.</p>
      </CardContent></Card>
    </div>
  );
};
