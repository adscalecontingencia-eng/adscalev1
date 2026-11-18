import React, { useMemo, useState } from 'react';
import { tr } from '@/i18n';
import { Users, DollarSign, AlertTriangle, AlertCircle, CheckCircle2, Megaphone, Search, Plus, Eye, Trash2, Wallet, Building2, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AgencyClientGoalsDialog } from './AgencyClientGoalsDialog';

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
  agencyId?: string;
  tiers?: any[];
  platformPcts?: number[];
  onTiersChanged?: () => void;
}

const Kpi = ({ icon: I, label, value, hint, tone = '' }: any) => (
  <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-xl p-4">
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground"><span className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center"><I size={13} className={tone} /></span>{label}</div>
    <p className={`text-2xl font-bold mt-2 ${tone}`}>{value}</p>
    <p className="text-[11px] text-muted-foreground">{hint}</p>
  </div>
);

/** Clients page for the agency, modeled on the AD SCALE "Carteira de clientes". */
export const AgencyClientsSection: React.FC<Props> = ({ subs, summary, credits, accountsOf, creditBalance, onView, onDelete, onCreate, onAddCredit, agencyId, tiers = [], platformPcts = [], onTiersChanged }) => {
  const [goalsFor, setGoalsFor] = useState<any>(null);
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
        <p className="text-[10px] uppercase tracking-[0.3em] text-primary">{tr('agency.clients.eyebrow')}</p>
        <h2 className="text-3xl font-bold mt-1" dangerouslySetInnerHTML={{ __html: tr('agency.clients.title').replace('<span>', '<span class="text-primary">') }} />
        <p className="text-sm text-muted-foreground mt-1">{tr('agency.clients.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi icon={Users} label={tr('agency.clients.kClients')} value={subs.length} hint={tr('agency.clients.withAccounts', { n: rows.filter(r => r.accs.length).length })} />
        <Kpi icon={DollarSign} label={tr('agency.clients.kSpend')} value={usd(tot.spend)} hint={tr('agency.clients.inSelectedWeek')} />
        <Kpi icon={AlertTriangle} label={tr('agency.clients.accumulated')} value={usd(tot.late)} hint={tr('agency.clients.openAfterDeposit')} tone="text-warning" />
        <Kpi icon={AlertCircle} label={tr('agency.clients.depositLeft')} value={usd(tot.credit)} hint={tr('agency.clients.notDeducted')} tone="text-primary" />
        <Kpi icon={CheckCircle2} label={tr('agency.clients.yourMargin')} value={usd(tot.margin)} hint={tr('agency.clients.inWeek')} tone="text-primary" />
        <Kpi icon={AlertCircle} label={tr('agency.clients.delinquent')} value={tot.lateCount} hint={tr('agency.clients.withAccumulated')} tone="text-destructive" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 h-11" placeholder={tr('agency.clients.search')} value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <span className="text-xs text-muted-foreground">{tr('agency.clients.ofTotal', { n: filtered.length, total: subs.length })}</span>
        <Button className="gap-2 h-11" onClick={() => setOpenNew(true)}><Plus size={15} />{tr('agency.clients.newClientBtn')}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mr-1">{tr('agency.clients.status')}</span>
        {[['todos', tr('agency.clients.f.all')], ['em_dia', tr('agency.clients.f.ok')], ['atrasado', tr('agency.clients.f.late')], ['sem_gasto', tr('agency.clients.f.noSpend')]].map(([v, l]) => <Chip key={v} on={status === v} onClick={() => setStatus(v)}>{l}</Chip>)}
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground ml-3 mr-1">{tr('agency.clients.sortBy')}</span>
        {[['saldo', tr('agency.clients.o.balance')], ['recente', tr('agency.clients.o.recent')], ['az', 'A–Z']].map(([v, l]) => <Chip key={v} on={order === v} onClick={() => setOrder(v)}>{l}</Chip>)}
      </div>

      <div className="space-y-4">
        {filtered.map(({ s, row, cb, balance, accs, late }) => (
          <div key={s.id} className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 space-y-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-[220px]">
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary">#{s.id.slice(0, 8)}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">{tr('agency.clients.rental')}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${late ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'}`}>● {late ? tr('agency.clients.badgeLate') : tr('agency.clients.badgeOk')}</span>
                  {row?.tier_name && <span className="text-[10px] px-2 py-0.5 rounded border border-warning/40 text-warning font-semibold">{row.tier_name}</span>}
                </div>
                <h3 className="text-2xl font-bold">{s.name}</h3>
                {s.phone && <p className="text-sm text-primary flex items-center gap-1 mt-0.5"><Building2 size={13} />{s.phone}</p>}
                <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                  <span>{s.email || tr('agency.clients.noEmail')}</span>
                  <span className="text-primary">{tr('agency.clients.basePct', { pct: row?.client_pct ?? '—' })}</span>
                  <span>{tr('agency.clients.nAccounts', { n: accs.length })}</span>
                  <span className="text-primary">{tr('agency.clients.depositLine', { paid: usd(cb.paid), left: usd(Math.max(0, balance)) })}</span>
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" className="gap-1 h-8 border-primary/40 text-primary" onClick={() => onView(s.id)}><Eye size={13} />{tr('agency.clients.viewAsClient')}</Button>
                {agencyId && <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => setGoalsFor(s)}><Target size={13} />{tr('agency.clients.weeklyGoals')}{tiers.some(t => t.sub_client_id === s.id) ? ' ★' : ''}</Button>}
                <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => setCreditFor(s)}><Wallet size={13} />{tr('agency.clients.addCredit')}</Button>
                <Button size="icon" variant="ghost" onClick={() => onDelete(s.id)}><Trash2 size={14} /></Button>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { l: tr('agency.clients.weekSpend'), v: usd(row?.spend), t: '' },
                { l: tr('agency.clients.estCommission', { pct: row?.client_pct ?? 0 }), v: usd(row?.client_fee), t: 'text-primary' },
                { l: tr('agency.clients.depositCredit'), v: usd(cb.paid), t: 'text-primary' },
                { l: tr('agency.clients.depositLeft'), v: usd(Math.max(0, balance)), t: 'text-primary' },
                { l: tr('agency.clients.accumulated'), v: usd(Math.max(0, -balance)), t: 'text-warning', hl: late },
              ].map(k => (
                <div key={k.l} className={`rounded-xl border p-3 ${k.hl ? 'border-destructive/50 bg-destructive/5' : 'border-border/60 bg-secondary/30'}`}>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{k.l}</p>
                  <p className={`text-lg font-bold mt-1 ${k.t}`}>{k.v}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border/60"><Megaphone size={12} />{tr('agency.clients.activeBlocked', { active: accs.filter(a => a.account_status === 1).length, blocked: accs.filter(a => a.account_status !== 1).length })}</span>
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border/60">{tr('agency.clients.agencyMargin')} <b className="text-primary">{usd(row?.agency_margin)}</b></span>
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg border border-warning/40">{tr('agency.clients.adscaleShare')} <b className="text-warning">{usd(row?.adscale_fee)}</b></span>
              <span className="px-2 py-1">{tr('agency.clients.depositEntries', { n: credits.filter(c => c.sub_client_id === s.id).length })}</span>
            </div>
          </div>
        ))}
        {!filtered.length && <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">{tr('agency.clients.noneFound')}</div>}
      </div>

      {agencyId && <AgencyClientGoalsDialog sub={goalsFor} agencyId={agencyId} tiers={tiers} platformPcts={platformPcts} onClose={() => setGoalsFor(null)} onSaved={() => onTiersChanged?.()} />}

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tr('agency.clients.newClient')}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>{tr('agency.clients.nameCompany')}</Label><Input maxLength={120} value={nw.name} onChange={e => setNw({ ...nw, name: e.target.value })} /></div>
            <div><Label>{tr('agency.clients.email')}</Label><Input type="email" maxLength={255} value={nw.email} onChange={e => setNw({ ...nw, email: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input maxLength={30} value={nw.phone} onChange={e => setNw({ ...nw, phone: e.target.value })} /></div>
            <div><Label>{tr('agency.clients.initialDeposit')}</Label><Input inputMode="decimal" placeholder="0,00" value={nw.credit} onChange={e => setNw({ ...nw, credit: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={submitNew}>{tr('agency.clients.registerClient')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!creditFor} onOpenChange={o => !o && setCreditFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tr('agency.clients.addDepositFor', { name: creditFor?.name })}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>{tr('agency.clients.amount')}</Label><Input inputMode="decimal" value={cr.amount} onChange={e => setCr({ ...cr, amount: e.target.value })} /></div>
            <div><Label>{tr('agency.clients.note')}</Label><Input maxLength={200} placeholder={tr('agency.clients.notePh')} value={cr.note} onChange={e => setCr({ ...cr, note: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">{tr('agency.clients.depositHint')}</p>
          </div>
          <DialogFooter><Button onClick={submitCredit}>{tr('agency.clients.addCredit')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
