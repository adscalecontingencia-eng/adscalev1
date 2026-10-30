import React from 'react';
import { Eye, ArrowLeft, Wallet, TrendingUp, Percent, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AgencyAccountsTable } from './AgencyAccountsTable';
import { AgencyAccount } from './agency-accounts';

const usd = (n: any) => `US$ ${Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  brand: string;
  logoUrl?: string | null;
  sub: any;
  row: any; // summary row for this sub-client
  accounts: AgencyAccount[];
  credits: any[];
  onBack: () => void;
}

/** What the agency's end client sees — agency branding only, no AD SCALE costs. */
export const SubClientView: React.FC<Props> = ({ brand, logoUrl, sub, row, accounts, credits, onBack }) => {
  const paid = credits.filter(c => c.status === 'confirmado').reduce((a, c) => a + Number(c.amount), 0);
  const used = row ? Number(row.client_fee) : 0;
  const active = accounts.filter(a => a.account_status === 1).length;
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground text-xs px-4 py-2 flex items-center gap-2">
        <Eye size={14} /> Você está vendo o painel do cliente <b>{sub.name}</b> como ele vê.
        <Button size="sm" variant="secondary" className="ml-auto h-7 gap-1" onClick={onBack}><ArrowLeft size={12} />Voltar ao painel da agência</Button>
      </div>
      <header className="h-14 border-b border-border/60 flex items-center px-6 gap-3">
        {logoUrl ? <img src={logoUrl} alt={brand} className="h-8 max-w-[160px] object-contain" /> : <span translate="no" className="notranslate font-display font-semibold text-primary">{brand}</span>}
        <span className="text-xs text-muted-foreground">Painel do cliente</span>
        <span className="ml-auto text-sm">{sub.name}</span>
      </header>
      <div className="max-w-6xl mx-auto p-4 lg:p-6 space-y-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">Bem-vindo</p>
          <h1 className="text-2xl font-bold">Sua operação em tempo real</h1>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi icon={TrendingUp} label="Gasto em anúncios (semana)" value={usd(row?.spend)} />
          <Kpi icon={Percent} label={`Taxa (${row?.client_pct ?? 0}%)`} value={usd(row?.client_fee)} sub={row?.tier_name ? `Nível ${row.tier_name}` : undefined} />
          <Kpi icon={Wallet} label={paid - used >= 0 ? "Caução restante" : "Saldo acumulado"} value={usd(Math.abs(paid - used))} sub={`Caução paga ${usd(paid)} · abatida da comissão`} />
          <Kpi icon={ShieldCheck} label="Contas ativas" value={`${active} / ${accounts.length}`} />
        </div>
        <Card><CardHeader><CardTitle className="text-base">Contas de anúncio</CardTitle></CardHeader><CardContent><AgencyAccountsTable accounts={accounts} /></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Histórico de caução</CardTitle></CardHeader><CardContent className="text-sm space-y-2">
          {credits.map(c => <div key={c.id} className="flex justify-between border-b border-border/40 pb-2"><span>{c.date}{c.note ? ` · ${c.note}` : ''}</span><span className="text-primary">{usd(c.amount)}</span></div>)}
          {!credits.length && <p className="text-muted-foreground">Nenhuma caução registrada.</p>}
        </CardContent></Card>
      </div>
    </div>
  );
};

const Kpi = ({ icon: Icon, label, value, sub }: any) => (
  <Card><CardContent className="pt-5 space-y-1"><Icon size={16} className="text-primary" /><p className="text-xl font-bold">{value}</p><p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>{sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}</CardContent></Card>
);
