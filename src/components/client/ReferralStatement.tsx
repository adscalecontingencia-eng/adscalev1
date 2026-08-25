import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import {
  DollarSign, Gift, Target, Filter, Search, Download, TrendingUp, Clock, CheckCircle2, XCircle,
} from 'lucide-react';

export type StatementEntry = {
  id: string;
  created_at: string;
  type: 'signup' | 'milestone' | 'manual';
  amount: number;
  status: 'pending' | 'applied' | 'cancelled';
  note: string | null;
  milestone_index: number | null;
  applied_at: string | null;
  referrer_id: string | null;
  referrer_name: string | null;
  referred_id: string | null;
  referred_name: string | null;
};

export type StatementProgress = {
  referrer_id: string;
  referrer_name: string | null;
  referred_id: string;
  referred_name: string | null;
  total_paid: number;
  next_index: number;
  remaining: number;
  progress_pct: number;
  next_bonus: number;
};

export type ReferralStatementData = {
  ok: boolean;
  scope?: 'all' | 'client';
  client_id?: string;
  client_name?: string;
  referral_code?: string;
  entries?: StatementEntry[];
  progress?: StatementProgress[];
  alerts?: any[];
  totals?: {
    total: number; pending: number; applied: number; cancelled: number;
    signup_count: number; milestone_count: number;
  };
};

const T = {
  pt: {
    title: 'Extrato do programa de indicação',
    subtitle: 'Todos os créditos gerados, com data, origem e status.',
    all: 'Todos', signup: 'Cadastro (US$ 20)', milestone: 'Bônus US$ 1.000 (US$ 50)', manual: 'Ajuste manual',
    pending: 'Pendente', applied: 'Aprovado', cancelled: 'Cancelado',
    searchPh: 'Buscar por indicado, parceiro ou descrição...',
    date: 'Data', origin: 'Origem', referred: 'Indicado', partner: 'Parceiro', amount: 'Valor', status: 'Status', note: 'Descrição',
    total: 'Total em créditos', totalPending: 'Pendentes', totalApplied: 'Aprovados', entries: 'Lançamentos',
    empty: 'Nenhum crédito encontrado com os filtros atuais.',
    progressTitle: 'Progresso para o próximo bônus de US$ 50',
    remaining: 'Faltam',
    nextBonus: 'Próximo crédito estimado',
    paid: 'Pago à agência',
    export: 'Exportar CSV',
    loading: 'Carregando extrato...',
    unavailable: 'Extrato indisponível no momento.',
  },
  en: {
    title: 'Referral program statement',
    subtitle: 'Every credit earned, with date, source and status.',
    all: 'All', signup: 'Signup (US$ 20)', milestone: 'US$ 1,000 bonus (US$ 50)', manual: 'Manual adjustment',
    pending: 'Pending', applied: 'Approved', cancelled: 'Cancelled',
    searchPh: 'Search by referral, partner or description...',
    date: 'Date', origin: 'Source', referred: 'Referral', partner: 'Partner', amount: 'Amount', status: 'Status', note: 'Description',
    total: 'Total credits', totalPending: 'Pending', totalApplied: 'Approved', entries: 'Entries',
    empty: 'No credits match the current filters.',
    progressTitle: 'Progress to the next US$ 50 bonus',
    remaining: 'Remaining',
    nextBonus: 'Estimated next credit',
    paid: 'Paid to agency',
    export: 'Export CSV',
    loading: 'Loading statement...',
    unavailable: 'Statement unavailable right now.',
  },
  es: {
    title: 'Extracto del programa de referidos',
    subtitle: 'Todos los créditos generados, con fecha, origen y estado.',
    all: 'Todos', signup: 'Registro (US$ 20)', milestone: 'Bono US$ 1.000 (US$ 50)', manual: 'Ajuste manual',
    pending: 'Pendiente', applied: 'Aprobado', cancelled: 'Cancelado',
    searchPh: 'Buscar por referido, socio o descripción...',
    date: 'Fecha', origin: 'Origen', referred: 'Referido', partner: 'Socio', amount: 'Importe', status: 'Estado', note: 'Descripción',
    total: 'Total en créditos', totalPending: 'Pendientes', totalApplied: 'Aprobados', entries: 'Movimientos',
    empty: 'Ningún crédito con los filtros actuales.',
    progressTitle: 'Progreso hacia el próximo bono de US$ 50',
    remaining: 'Faltan',
    nextBonus: 'Próximo crédito estimado',
    paid: 'Pagado a la agencia',
    export: 'Exportar CSV',
    loading: 'Cargando extracto...',
    unavailable: 'Extracto no disponible ahora.',
  },
} as const;

export const useStatementDict = () => {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('en') ? 'en' : i18n.language?.startsWith('es') ? 'es' : 'pt';
  return T[lang as keyof typeof T];
};

export const useReferralStatement = (clientId?: string | null) => {
  const [data, setData] = useState<ReferralStatementData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.rpc('get_referral_statement' as any, {
        _client_id: clientId ?? null,
      } as any);
      if (error) throw error;
      setData(res as unknown as ReferralStatementData);
    } catch (e) {
      console.warn('[referral-statement] falha', e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, reload: load };
};

const money = (v: number, locale: string) =>
  `US$ ${Number(v || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ReferralStatement: React.FC<{ clientId?: string | null }> = ({ clientId }) => {
  const d = useStatementDict();
  const { i18n } = useTranslation();
  const locale = i18n.language?.startsWith('en') ? 'en-US' : i18n.language?.startsWith('es') ? 'es-ES' : 'pt-BR';
  const { data, loading } = useReferralStatement(clientId);

  const [type, setType] = useState<'all' | 'signup' | 'milestone' | 'manual'>('all');
  const [status, setStatus] = useState<'all' | 'pending' | 'applied' | 'cancelled'>('all');
  const [q, setQ] = useState('');

  const entries = useMemo(() => {
    const list = data?.entries || [];
    const term = q.trim().toLowerCase();
    return list.filter((e) => {
      if (type !== 'all' && e.type !== type) return false;
      if (status !== 'all' && e.status !== status) return false;
      if (term) {
        const hay = `${e.referred_name || ''} ${e.referrer_name || ''} ${e.note || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [data?.entries, type, status, q]);

  const filteredTotals = useMemo(() => ({
    total: entries.filter((e) => e.status !== 'cancelled').reduce((s, e) => s + Number(e.amount || 0), 0),
    pending: entries.filter((e) => e.status === 'pending').reduce((s, e) => s + Number(e.amount || 0), 0),
    applied: entries.filter((e) => e.status === 'applied').reduce((s, e) => s + Number(e.amount || 0), 0),
  }), [entries]);

  const originLabel = (e: StatementEntry) =>
    e.type === 'signup' ? d.signup : e.type === 'milestone' ? d.milestone : d.manual;
  const statusLabel = (s: string) => (s === 'applied' ? d.applied : s === 'cancelled' ? d.cancelled : d.pending);

  const exportCsv = () => {
    const rows = [
      [d.date, d.origin, d.partner, d.referred, d.amount, d.status, d.note],
      ...entries.map((e) => [
        new Date(e.created_at).toLocaleString(locale),
        originLabel(e),
        e.referrer_name || '',
        e.referred_name || '',
        Number(e.amount || 0).toFixed(2),
        statusLabel(e.status),
        (e.note || '').replace(/[\r\n;]+/g, ' '),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `extrato-indicacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="rounded-2xl border border-border/60 bg-card/60 p-8 text-center text-sm text-muted-foreground">{d.loading}</div>;
  }
  if (!data?.ok) {
    return <div className="rounded-2xl border border-border/60 bg-card/60 p-8 text-center text-sm text-muted-foreground">{d.unavailable}</div>;
  }

  const progress = (data.progress || []).slice().sort((a, b) => Number(b.progress_pct) - Number(a.progress_pct));

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card/70 to-card/60 p-5 sm:p-6">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <DollarSign size={20} className="text-primary" /> {d.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{d.subtitle}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: d.total, value: money(filteredTotals.total, locale), icon: DollarSign },
          { label: d.totalPending, value: money(filteredTotals.pending, locale), icon: Clock },
          { label: d.totalApplied, value: money(filteredTotals.applied, locale), icon: CheckCircle2 },
          { label: d.entries, value: String(entries.length), icon: Gift },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-border/60 bg-card/60 p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <k.icon size={12} className="text-primary" /> {k.label}
            </div>
            <div className="text-lg sm:text-xl font-bold text-foreground mt-2">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Progress to next bonus */}
      {progress.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
            <Target size={15} className="text-primary" /> {d.progressTitle}
          </div>
          <div className="space-y-2">
            {progress.map((p) => (
              <div key={`${p.referrer_id}-${p.referred_id}`} className="rounded-xl border border-border/50 bg-secondary/30 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{p.referred_name}</span>
                  <span className="text-xs font-semibold text-primary flex items-center gap-1">
                    <TrendingUp size={12} /> {d.nextBonus}: {money(p.next_bonus, locale)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>{d.paid}: <strong className="text-foreground/90">{money(p.total_paid, locale)}</strong></span>
                  <span>{d.remaining}: <strong className="text-foreground/90">{money(p.remaining, locale)}</strong></span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-border/60 overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, Number(p.progress_pct) || 0)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-2xl border border-border/60 bg-card/60 p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder={d.searchPh}
            className="w-full bg-secondary/50 border border-border rounded-xl pl-9 pr-3 py-2.5 text-xs text-foreground outline-none focus:border-primary/50"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Filter size={13} className="text-primary" />
          </div>
          <select value={type} onChange={(e) => setType(e.target.value as any)}
            className="bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-xs text-foreground outline-none focus:border-primary/50">
            <option value="all">{d.all}</option>
            <option value="signup">{d.signup}</option>
            <option value="milestone">{d.milestone}</option>
            <option value="manual">{d.manual}</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)}
            className="bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-xs text-foreground outline-none focus:border-primary/50">
            <option value="all">{d.all}</option>
            <option value="pending">{d.pending}</option>
            <option value="applied">{d.applied}</option>
            <option value="cancelled">{d.cancelled}</option>
          </select>
          <button onClick={exportCsv}
            className="flex items-center gap-2 bg-secondary/70 border border-border text-xs font-medium rounded-xl px-4 py-2.5 hover:bg-secondary transition-all">
            <Download size={14} /> {d.export}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/60 bg-card/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                <th className="px-4 py-3 font-medium">{d.date}</th>
                <th className="px-4 py-3 font-medium">{d.origin}</th>
                {data.scope === 'all' && <th className="px-4 py-3 font-medium">{d.partner}</th>}
                <th className="px-4 py-3 font-medium">{d.referred}</th>
                <th className="px-4 py-3 font-medium">{d.note}</th>
                <th className="px-4 py-3 font-medium text-right">{d.amount}</th>
                <th className="px-4 py-3 font-medium text-right">{d.status}</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-xs text-muted-foreground">{d.empty}</td></tr>
              ) : entries.map((e) => (
                <tr key={e.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/20">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(e.created_at).toLocaleDateString(locale)}{' '}
                    <span className="opacity-60">{new Date(e.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
                      e.type === 'milestone' ? 'text-primary border-primary/30 bg-primary/10' : 'text-foreground/80 border-border bg-secondary/40'
                    }`}>
                      {e.type === 'milestone' ? <Target size={11} /> : <Gift size={11} />} {originLabel(e)}
                    </span>
                  </td>
                  {data.scope === 'all' && <td className="px-4 py-3 text-xs text-foreground/90">{e.referrer_name || '—'}</td>}
                  <td className="px-4 py-3 text-xs text-foreground/90">{e.referred_name || '—'}</td>
                  <td className="px-4 py-3 text-[11px] text-muted-foreground max-w-[280px] truncate">{e.note || '—'}</td>
                  <td className="px-4 py-3 text-sm font-bold text-foreground text-right whitespace-nowrap">{money(e.amount, locale)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 border ${
                      e.status === 'applied' ? 'text-primary border-primary/30 bg-primary/10'
                        : e.status === 'cancelled' ? 'text-muted-foreground border-border bg-secondary/40'
                        : 'text-warning border-warning/30 bg-warning/10'
                    }`}>
                      {e.status === 'applied' ? <CheckCircle2 size={10} /> : e.status === 'cancelled' ? <XCircle size={10} /> : <Clock size={10} />}
                      {statusLabel(e.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReferralStatement;
