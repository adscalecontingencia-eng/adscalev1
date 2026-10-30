import React, { useMemo, useState } from 'react';
import { Users, DollarSign, AlertTriangle, AlertCircle, CheckCircle2, Megaphone, Search, Plus, Eye, Trash2, Wallet, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const usd = (n: any) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  subs: any[];
  summary: any;
  credits: any[];
  accountsOf: (id: string) => any[];
  creditBalance: (id: string) => { paid: number; weekUse: number };
  onView: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: (v: { name: string; email: string; phone: string; credit: number }) => Promise<void>;
  onAddCredit: (subId: string, amount: number, note: string) => Promise<void>;
}

const Kpi = ({ icon: I, label, value, hint, tone = '' }: any) => (
  <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-xl p-4">
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground"><span className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center"><I size={13} className={tone} /></span>{label}</div>
    <p className={`text-2xl font-bold mt-2 ${tone}`}>{value}</p>
    <p className="text-[11px] text-muted-foreground">{hint}</p>
  </div>
);

/** Clients page for the agency, modeled on the AD SCALE "Carteira de clientes". */
export const AgencyClientsSection: React.FC<Props> = ({ subs, summary, credits, accountsOf, creditBalance, onView, onDelete, onCreate, onAddCredit }) => {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('todos');
  const [order, setOrder] = useState('saldo');
  const [openNew, setOpenNew] = useState(false);
  const [nw, setNw] = useState({ name: '', email: '', phone: '', credit: '' });
  const [creditFor, setCreditFor] = useState<any>(null);
  const [cr, setCr] = useState({ amount: '', note: '' });

  const rows = useMemo(() => subs.map(s => {
    const row = summary?.sub_clients?.find((r: any) => r.sub_client_id === s.id);
    const cb = creditBalance(s.id);
    const balance = cb.paid - cb.weekUse;
    const accs = accountsOf(s.id);
    return { s, row, cb, balance, accs, late: balance < 0, noSpend: !row?.spend };
  }), [subs, summary, creditBalance, accountsOf]);

  const filtered = rows
    .filter(r => !q || `${r.s.name} ${r.s.email || ''} ${r.s.phone || ''}`.toLowerCase().includes(q.toLowerCase()))
    .filter(r => status === 'todos' || (status === 'atrasado' ? r.late : status === 'sem_gasto' ? r.noSpend : !r.late))
    .sort((a, b) => order === 'az' ? a.s.name.localeCompare(b.s.name) : order === 'recente' ? (b.s.created_at || '').localeCompare(a.s.created_at || '') : b.balance - a.balance);

  const tot = {
    spend: rows.reduce((t, r) => t + Number(r.row?.spend || 0), 0),
    credit: rows.reduce((t, r) => t + Math.max(0, r.balance), 0),
    late: rows.reduce((t, r) => t + Math.max(0, -r.balance), 0),
    margin: rows.reduce((t, r) => t + Number(r.row?.agency_margin || 0), 0),
    lateCount: rows.filter(r => r.late).length,
  };

  const submitNew = async () => {
    if (!nw.name.trim()) return;
    await onCreate({ name: nw.name.trim().slice(0, 120), email: nw.email.trim().slice(0, 255), phone: nw.phone.trim().slice(0, 30), credit: Number(nw.credit.replace(',', '.')) || 0 });
    setNw({ name: '', email: '', phone: '', credit: '' }); setOpenNew(false);
  };
  const submitCredit = async () => {
    const amount = Number(cr.amount.replace(',', '.'));
    if (!amount || !creditFor) return;
    await onAddCredit(creditFor.id, amount, cr.note.trim().slice(0, 200));
    setCr({ amount: '', note: '' }); setCreditFor(null);
  };

  const Chip = ({ on, children, onClick }: any) => <button onClick={onClick} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${on ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-muted-foreground hover:text-foreground'}`}>{children}</button>;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-6">
        <p className="text-[10px] uppercase tracking-[0.3em] text-primary">✱ Clientes & comissões</p>
        <h2 className="text-3xl font-bold mt-1">Carteira de <span className="text-primary">clientes</span></h2>
        <p className="text-sm text-muted-foreground mt-1">Gestão completa dos seus clientes, caução, comissões e fechamento semanal de Ad Spend.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi icon={Users} label="Clientes" value={subs.length} hint={`${rows.filter(r => r.accs.length).length} com contas`} />
        <Kpi icon={DollarSign} label="Gasto em ads" value={usd(tot.spend)} hint="na semana selecionada" />
        <Kpi icon={AlertTriangle} label="Saldo acumulado" value={usd(tot.late)} hint="comissão em aberto após a caução" tone="text-warning" />
        <Kpi icon={AlertCircle} label="Caução restante" value={usd(tot.credit)} hint="crédito ainda não abatido" tone="text-primary" />
        <Kpi icon={CheckCircle2} label="Sua margem" value={usd(tot.margin)} hint="na semana" tone="text-primary" />
        <Kpi icon={AlertCircle} label="Inadimplentes" value={tot.lateCount} hint="com saldo acumulado" tone="text-destructive" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 h-11" placeholder="Buscar por nome, e-mail ou número..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} de {subs.length}</span>
        <Button className="gap-2 h-11" onClick={() => setOpenNew(true)}><Plus size={15} />Novo Cliente</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mr-1">Status</span>
        {[['todos', 'Todos'], ['em_dia', 'Em dia'], ['atrasado', 'Com saldo acumulado'], ['sem_gasto', 'Sem gasto']].map(([v, l]) => <Chip key={v} on={status === v} onClick={() => setStatus(v)}>{l}</Chip>)}
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground ml-3 mr-1">Ordenar</span>
        {[['saldo', 'Maior saldo'], ['recente', 'Mais recente'], ['az', 'A–Z']].map(([v, l]) => <Chip key={v} on={order === v} onClick={() => setOrder(v)}>{l}</Chip>)}
      </div>

      <div className="space-y-4">
        {filtered.map(({ s, row, cb, balance, accs, late }) => (
          <div key={s.id} className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 space-y-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-[220px]">
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary">#{s.id.slice(0, 8)}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">ALUGUEL</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${late ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'}`}>● {late ? 'SALDO ACUMULADO' : 'EM DIA'}</span>
                  {row?.tier_name && <span className="text-[10px] px-2 py-0.5 rounded border border-warning/40 text-warning font-semibold">{row.tier_name}</span>}
                </div>
                <h3 className="text-2xl font-bold">{s.name}</h3>
                {s.phone && <p className="text-sm text-primary flex items-center gap-1 mt-0.5"><Building2 size={13} />{s.phone}</p>}
                <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                  <span>{s.email || 'sem e-mail'}</span>
                  <span className="text-primary">{row?.client_pct ?? '—'}% base</span>
                  <span>{accs.length} contas</span>
                  <span className="text-primary">Caução {usd(cb.paid)} · restante {usd(Math.max(0, balance))}</span>
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" className="gap-1 h-8 border-primary/40 text-primary" onClick={() => onView(s.id)}><Eye size={13} />Ver como cliente</Button>
                <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => setCreditFor(s)}><Wallet size={13} />Adicionar crédito</Button>
                <Button size="icon" variant="ghost" onClick={() => onDelete(s.id)}><Trash2 size={14} /></Button>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { l: 'Gasto da semana', v: usd(row?.spend), t: '' },
                { l: `Comissão est. (${row?.client_pct ?? 0}%)`, v: usd(row?.client_fee), t: 'text-primary' },
                { l: 'Caução (crédito)', v: usd(cb.paid), t: 'text-primary' },
                { l: 'Caução restante', v: usd(Math.max(0, balance)), t: 'text-primary' },
                { l: 'Saldo acumulado', v: usd(Math.max(0, -balance)), t: 'text-warning', hl: late },
              ].map(k => (
                <div key={k.l} className={`rounded-xl border p-3 ${k.hl ? 'border-destructive/50 bg-destructive/5' : 'border-border/60 bg-secondary/30'}`}>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{k.l}</p>
                  <p className={`text-lg font-bold mt-1 ${k.t}`}>{k.v}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border/60"><Megaphone size={12} />{accs.filter(a => a.account_status === 1).length} ativas · {accs.filter(a => a.account_status !== 1).length} bloqueadas</span>
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border/60">Margem da agência: <b className="text-primary">{usd(row?.agency_margin)}</b></span>
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg border border-warning/40">Repasse AD SCALE: <b className="text-warning">{usd(row?.adscale_fee)}</b></span>
              <span className="px-2 py-1">{credits.filter(c => c.sub_client_id === s.id).length} lançamentos de caução</span>
            </div>
          </div>
        ))}
        {!filtered.length && <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</div>}
      </div>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome / empresa</Label><Input maxLength={120} value={nw.name} onChange={e => setNw({ ...nw, name: e.target.value })} /></div>
            <div><Label>E-mail</Label><Input type="email" maxLength={255} value={nw.email} onChange={e => setNw({ ...nw, email: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input maxLength={30} value={nw.phone} onChange={e => setNw({ ...nw, phone: e.target.value })} /></div>
            <div><Label>Caução inicial (US$)</Label><Input inputMode="decimal" placeholder="0,00" value={nw.credit} onChange={e => setNw({ ...nw, credit: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={submitNew}>Cadastrar cliente</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!creditFor} onOpenChange={o => !o && setCreditFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar caução · {creditFor?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Valor (US$)</Label><Input inputMode="decimal" value={cr.amount} onChange={e => setCr({ ...cr, amount: e.target.value })} /></div>
            <div><Label>Observação</Label><Input maxLength={200} placeholder="Pix, recarga..." value={cr.note} onChange={e => setCr({ ...cr, note: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">A caução é descontada integralmente da comissão do cliente até zerar. Ela não recarrega as contas de anúncio.</p>
          </div>
          <DialogFooter><Button onClick={submitCredit}>Adicionar crédito</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
