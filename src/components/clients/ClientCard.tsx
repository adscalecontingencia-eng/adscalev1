import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye,
  Edit2,
  Trash2,
  KeyRound,
  CheckCircle,
  History,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CircleDot,
  CalendarIcon,
  Gem,
  Crown,
  Building2,
  ChevronDown,
  Layers,
  Ban,
  Zap,
  Copy,
  Search,
} from 'lucide-react';
import { BillingAudit, getLastClosedBillingWeekRange } from '@/lib/billing-status';
import { BillingAuditDialog } from './BillingAuditDialog';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays, startOfDay, endOfDay, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDateLocal } from '@/lib/date-utils';
import { computeLoyaltyProgress } from '@/lib/loyalty-tiers';
import { toast } from 'sonner';

export interface ClientLite {
  id: string;
  number: string;
  name: string;
  companyName: string;
  email: string;
  clientType: 'aluguel' | 'venda';
  fixedValue?: number;
  percentageValue?: number;
  planCredit?: number;
  adAccounts: number;
  usedAccounts: number;
  blockedAccounts: number;
}

export type ClientStatus = 'em_dia' | 'pendente' | 'atrasado' | 'sem_gasto';

export interface AccountBreakdown {
  id: string;
  meta_account_id: string;
  name: string;
  status: string;
  account_status: number | null;
  spendByDay: { date: string; spend: number }[];
}

type PeriodKey = 'today' | 'billing_week' | 'last_billing_week' | '7d' | '30d' | 'custom';

interface Props {
  client: ClientLite;
  totalAdSpend: number;
  comissaoPendente: number;
  comissaoPaga: number;
  saldoPendente: number;
  saldoAtrasado: number;
  creditRemaining?: number;
  audit?: BillingAudit | null;
  status: ClientStatus;
  spendByDay: { date: string; spend: number }[];
  accounts?: AccountBreakdown[];
  isAdmin: boolean;
  showPayForm: boolean;
  isSubmittingPayment?: boolean;
  paidAmount: string;
  setPaidAmount: (s: string) => void;
  paidDate: Date;
  setPaidDate: (d: Date) => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onResetPassword?: () => void;
  onTogglePayForm: () => void;
  onSubmitPay: () => void;
  onOpenHistory: () => void;
}

const fmt = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const inputClass =
  'w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors';

const StatusBadge: React.FC<{ status: ClientStatus }> = ({ status }) => {
  const cfg = {
    em_dia: { label: 'Em dia', cls: 'bg-success/15 text-success border-success/30', dot: 'bg-success' },
    pendente: { label: 'Pendente', cls: 'bg-warning/15 text-warning border-warning/30', dot: 'bg-warning' },
    atrasado: { label: 'Atrasado', cls: 'bg-destructive/15 text-destructive border-destructive/30', dot: 'bg-destructive' },
    sem_gasto: { label: 'Sem gasto', cls: 'bg-muted/40 text-muted-foreground border-border', dot: 'bg-muted-foreground' },
  }[status];
  return (
    <span
      className={cn(
        'text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md font-medium border inline-flex items-center gap-1.5',
        cfg.cls
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
};

const Sparkline: React.FC<{ data: { date: string; spend: number }[] }> = ({ data }) => {
  const points = useMemo(() => {
    if (data.length === 0) return '';
    const max = Math.max(...data.map((d) => d.spend), 1);
    const W = 56;
    const H = 18;
    return data
      .map((d, i) => {
        const x = (i / Math.max(1, data.length - 1)) * W;
        const y = H - (d.spend / max) * H;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [data]);
  if (data.length === 0) return null;
  return (
    <svg width="56" height="18" className="ml-auto opacity-80">
      <polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const Stat: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'default' | 'primary' | 'warning' | 'success' | 'destructive';
  highlight?: boolean;
  right?: React.ReactNode;
}> = ({ icon, label, value, tone = 'default', highlight, right }) => {
  const toneClass = {
    default: 'text-foreground',
    primary: 'text-primary',
    warning: 'text-warning',
    success: 'text-success',
    destructive: 'text-destructive',
  }[tone];
  return (
    <div
      className={cn(
        'bg-secondary/60 rounded-lg p-2.5 border border-transparent transition-colors',
        highlight && 'border-primary/40 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]'
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        <span className={toneClass}>{icon}</span>
        <span className="truncate">{label}</span>
        {right}
      </div>
      <div className={cn('text-sm font-bold', toneClass)}>{value}</div>
    </div>
  );
};

// Soma spend dentro de um intervalo
const sumInRange = (rows: { date: string; spend: number }[], start: Date, end: Date) => {
  return rows.reduce((s, r) => {
    const d = parseDateLocal(r.date);
    if (isWithinInterval(d, { start, end })) return s + (r.spend || 0);
    return s;
  }, 0);
};

const getRangeFor = (period: PeriodKey, custom: { start?: Date; end?: Date }): { start: Date; end: Date } | null => {
  const now = new Date();
  if (period === 'today') return { start: startOfDay(now), end: endOfDay(now) };
  // Semana de cobrança do projeto: última semana fechada sexta → quinta.
  if (period === 'billing_week') {
    return getLastClosedBillingWeekRange(now);
  }
  if (period === 'last_billing_week') {
    const lastClosed = getLastClosedBillingWeekRange(now);
    return { start: startOfDay(subDays(lastClosed.start, 7)), end: endOfDay(subDays(lastClosed.end, 7)) };
  }
  if (period === '7d') return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
  if (period === '30d') return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
  if (period === 'custom' && custom.start && custom.end) {
    return { start: startOfDay(custom.start), end: endOfDay(custom.end) };
  }
  return null;
};

export const ClientCard: React.FC<Props> = (props) => {
  const {
    client: c,
    totalAdSpend,
    comissaoPendente,
    comissaoPaga,
    saldoPendente,
    saldoAtrasado,
    creditRemaining,
    audit,
    status,
    spendByDay,
    accounts = [],
    isAdmin,
    showPayForm,
    isSubmittingPayment = false,
    paidAmount,
    setPaidAmount,
    paidDate,
    setPaidDate,
    onView,
    onEdit,
    onDelete,
    onResetPassword,
    onTogglePayForm,
    onSubmitPay,
    onOpenHistory,
  } = props;

  const [period, setPeriod] = useState<PeriodKey>('billing_week');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [showStructure, setShowStructure] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  // sparkline: últimos 14 dias
  const last14 = useMemo(() => {
    const days: { date: string; spend: number }[] = [];
    const today = new Date();
    const map = new Map(spendByDay.map((d) => [d.date.slice(0, 10), d.spend]));
    for (let i = 13; i >= 0; i--) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      days.push({ date: key, spend: map.get(key) || 0 });
    }
    return days;
  }, [spendByDay]);

  // Ad Spend por período selecionado no card
  const periodRange = getRangeFor(period, { start: customStart, end: customEnd });
  const spendPeriod = useMemo(() => {
    if (!periodRange) return null;
    return sumInRange(spendByDay, periodRange.start, periodRange.end);
  }, [spendByDay, periodRange?.start, periodRange?.end]);

  const basePct = c.percentageValue || 0;
  const estCommissionPeriod = c.clientType === 'aluguel' && spendPeriod !== null
    ? spendPeriod * (basePct / 100)
    : null;

  const planCredit = c.planCredit || 0;
  const availableAccounts = c.adAccounts - c.usedAccounts - c.blockedAccounts;

  // Structure summary
  const activeAccts = accounts.filter(a => a.status === 'active');
  const blockedAccts = accounts.filter(a => a.status !== 'active');
  const accountsWithPeriodSpend = useMemo(() => {
    return accounts
      .map(a => ({
        ...a,
        spendPeriod: periodRange ? sumInRange(a.spendByDay, periodRange.start, periodRange.end) : 0,
        spendTotal: a.spendByDay.reduce((s, r) => s + (r.spend || 0), 0),
      }))
      .sort((a, b) => b.spendPeriod - a.spendPeriod);
  }, [accounts, periodRange?.start, periodRange?.end]);

  const PeriodPill: React.FC<{ id: PeriodKey; label: string }> = ({ id, label }) => (
    <button
      onClick={() => setPeriod(id)}
      className={cn(
        'px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors border',
        period === id
          ? 'bg-primary/15 text-primary border-primary/40'
          : 'bg-secondary/40 text-muted-foreground border-transparent hover:text-foreground hover:border-border'
      )}
    >
      {label}
    </button>
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl overflow-hidden border-glow"
    >
      <div className="p-4">
        {/* Header re-estruturado: destaque forte para empresa/nome */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono tracking-tight">#{c.number}</span>
              <span
                className={cn(
                  'text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-medium',
                  c.clientType === 'venda' ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary'
                )}
              >
                {c.clientType === 'venda' ? 'Venda' : 'Aluguel'}
              </span>
              <StatusBadge status={status} />
              {c.clientType === 'aluguel' && (() => {
                const lp = computeLoyaltyProgress(comissaoPaga);
                if (lp.current.id === 'standard') return null;
                const Icon = lp.current.id === 'elite' ? Crown : Gem;
                return (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                      lp.current.id === 'elite'
                        ? 'border-amber-400/50 text-amber-300 bg-amber-400/10 shadow-[0_0_10px_rgba(251,191,36,0.35)]'
                        : 'border-violet-400/50 text-violet-300 bg-violet-500/10 shadow-[0_0_10px_rgba(167,139,250,0.35)]',
                    )}
                    title={`Nível ${lp.current.label} · comissão base ${lp.current.basePct}%`}
                  >
                    <Icon size={10} /> {lp.current.label}
                  </span>
                );
              })()}
            </div>
            {/* Nome do cliente — destaque */}
            <h3 className="font-display text-xl sm:text-2xl font-bold leading-tight tracking-tight text-foreground truncate">
              {c.name}
            </h3>
            {/* Empresa como sub-heading proeminente */}
            {c.companyName && (
              <div className="flex items-center gap-1.5 mt-0.5 text-primary/90">
                <Building2 size={13} />
                <span className="text-sm font-semibold truncate">{c.companyName}</span>
              </div>
            )}
            {/* Metadados densos */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-2">
              {c.email && <span className="truncate max-w-[240px]">{c.email}</span>}
              <span className="text-primary/90">
                {c.clientType === 'venda'
                  ? `Fixo ${fmt(c.fixedValue || 0)}`
                  : `${basePct}% base`}
              </span>
              {c.clientType === 'aluguel' && (
                <span>
                  {availableAccounts} {availableAccounts === 1 ? 'conta disponível' : 'contas disponíveis'}
                </span>
              )}
              {planCredit > 0 && (
                <span className="text-success">
                  Crédito {fmt(planCredit)}
                  {typeof creditRemaining === 'number' && (
                    <span className="text-muted-foreground"> · restante <span className="text-success">{fmt(creditRemaining)}</span></span>
                  )}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onView}
              title="Ver dashboard do cliente"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-medium"
            >
              <Eye size={13} /> <span className="hidden sm:inline">Ver como cliente</span>
            </button>
            <button
              onClick={onEdit}
              title="Editar"
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
            >
              <Edit2 size={14} />
            </button>
            {onResetPassword && (
              <button
                onClick={onResetPassword}
                title="Redefinir senha do cliente"
                className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary"
              >
                <KeyRound size={14} />
              </button>
            )}
            <button
              onClick={onDelete}
              title="Excluir"
              className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Seletor de período do card */}
        <div className="mt-4 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Detalhar por período:</span>
          <PeriodPill id="today" label="Hoje" />
          <PeriodPill id="billing_week" label="Última semana fechada" />
          <PeriodPill id="last_billing_week" label="Semana fechada anterior" />
          <PeriodPill id="7d" label="7 dias corridos" />
          <PeriodPill id="30d" label="30 dias" />
          <Popover>
            <PopoverTrigger asChild>
              <button
                onClick={() => setPeriod('custom')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors',
                  period === 'custom'
                    ? 'bg-primary/15 text-primary border-primary/40'
                    : 'bg-secondary/40 text-muted-foreground border-transparent hover:text-foreground hover:border-border'
                )}
              >
                <CalendarIcon size={11} />
                {period === 'custom' && customStart && customEnd
                  ? `${format(customStart, 'dd/MM')} — ${format(customEnd, 'dd/MM')}`
                  : 'Personalizado'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-2 border-b border-border text-[11px] text-muted-foreground">Selecione início e fim</div>
              <div className="flex flex-col sm:flex-row">
                <Calendar
                  mode="single"
                  selected={customStart}
                  onSelect={(d) => { if (d) { setCustomStart(d); setPeriod('custom'); } }}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
                <Calendar
                  mode="single"
                  selected={customEnd}
                  onSelect={(d) => { if (d) { setCustomEnd(d); setPeriod('custom'); } }}
                  className="p-3 pointer-events-auto border-l border-border"
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* KPIs */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <Stat
            icon={<DollarSign size={11} />}
            label={
              period === 'today' ? 'Gasto hoje' :
              period === 'billing_week' ? 'Gasto última semana fechada' :
              period === 'last_billing_week' ? 'Gasto semana fechada anterior' :
              period === '7d' ? 'Gasto 7d corridos' :
              period === '30d' ? 'Gasto 30d' :
              'Gasto período'
            }
            value={fmt(spendPeriod ?? totalAdSpend)}
            right={<Sparkline data={last14} />}
          />
          <Stat
            icon={<Zap size={11} />}
            label={c.clientType === 'aluguel' ? `Comissão est. (${basePct}%)` : 'Comissão fixa'}
            value={fmt(
              c.clientType === 'aluguel'
                ? (estCommissionPeriod ?? 0)
                : (c.fixedValue || 0)
            )}
            tone="primary"
          />
          <Stat icon={<CheckCircle size={11} />} label="Comissão Paga" value={fmt(comissaoPaga)} tone="success" />
          <Stat
            icon={saldoPendente > 0 ? <AlertTriangle size={11} /> : <CircleDot size={11} />}
            label="Saldo Acumulado"
            value={fmt(saldoPendente)}
            tone={saldoPendente > 0 ? 'warning' : 'success'}
            highlight={saldoPendente > 0}
          />
          <Stat
            icon={saldoAtrasado > 0 ? <AlertTriangle size={11} /> : <CircleDot size={11} />}
            label="Saldo Atrasado"
            value={fmt(saldoAtrasado)}
            tone={saldoAtrasado > 0 ? 'destructive' : 'success'}
            highlight={saldoAtrasado > 0}
          />
        </div>

        {/* Ações */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isAdmin && c.clientType === 'aluguel' && (
            <button
              onClick={onTogglePayForm}
              className="flex items-center gap-1.5 text-xs bg-success/10 text-success px-3 py-1.5 rounded-lg hover:bg-success/20 border border-success/20 transition-colors"
            >
              <CheckCircle size={12} /> Validar Pagamento
            </button>
          )}
          {c.clientType === 'aluguel' && accounts.length > 0 && (
            <button
              onClick={() => setShowStructure(v => !v)}
              className={cn(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors',
                showStructure
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
              )}
            >
              <Layers size={12} /> Ver estrutura
              <span className="text-[10px] opacity-70">
                ({activeAccts.length} ativas · {blockedAccts.length} bloqueadas)
              </span>
              <ChevronDown size={12} className={cn('transition-transform', showStructure && 'rotate-180')} />
            </button>
          )}
          {c.clientType === 'aluguel' && (
            <button
              onClick={() => setShowAudit(true)}
              disabled={!audit}
              className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 border border-primary/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
              title="Ver como cada saldo foi calculado por semana"
            >
              <Search size={12} /> Auditar cálculo
            </button>
          )}
          <button
            onClick={onOpenHistory}
            className={cn(
              "flex items-center gap-1.5 text-xs bg-secondary text-muted-foreground px-3 py-1.5 rounded-lg hover:text-foreground border border-border transition-colors",
              c.clientType !== 'aluguel' && 'ml-auto'
            )}
          >
            <History size={12} /> Histórico
          </button>
        </div>

        {showPayForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mt-3 flex flex-col sm:flex-row gap-2 overflow-hidden"
          >
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-secondary border border-border text-foreground hover:border-primary transition-colors whitespace-nowrap">
                  <CalendarIcon size={14} />
                  {format(paidDate, 'dd/MM/yyyy', { locale: ptBR })}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={paidDate}
                  onSelect={(d) => d && setPaidDate(d)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <input
              type="number"
              placeholder="Valor pago $"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className={`${inputClass} flex-1`}
            />
            <button
              onClick={onSubmitPay}
              disabled={isSubmittingPayment}
              className="bg-success text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 whitespace-nowrap"
            >
              {isSubmittingPayment ? 'Registrando...' : 'Registrar'}
            </button>
          </motion.div>
        )}

        {/* Estrutura (contas de anúncio) */}
        <AnimatePresence initial={false}>
          {showStructure && c.clientType === 'aluguel' && (
            <motion.div
              key="structure"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 overflow-hidden"
            >
              <div className="rounded-xl border border-border bg-secondary/30 p-3">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-primary" />
                    <span className="text-xs font-semibold text-foreground">Estrutura de contas de anúncio</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider">
                    <span className="text-success flex items-center gap-1">
                      <CheckCircle size={10} /> {activeAccts.length} ativas
                    </span>
                    <span className="text-destructive flex items-center gap-1">
                      <Ban size={10} /> {blockedAccts.length} bloqueadas
                    </span>
                    <span className="text-muted-foreground">Total {accounts.length}</span>
                  </div>
                </div>

                {accountsWithPeriodSpend.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">
                    Nenhuma conta atribuída a este cliente.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                          <th className="text-left py-1.5 font-medium">Conta</th>
                          <th className="text-left py-1.5 font-medium">ID Meta</th>
                          <th className="text-left py-1.5 font-medium">Status</th>
                          <th className="text-right py-1.5 font-medium">Gasto período</th>
                          <th className="text-right py-1.5 font-medium">Comissão est.</th>
                          <th className="text-right py-1.5 font-medium">Gasto total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accountsWithPeriodSpend.map((a) => {
                          const isActive = a.status === 'active';
                          const acctCommission = c.clientType === 'aluguel'
                            ? a.spendPeriod * (basePct / 100)
                            : 0;
                          return (
                            <tr key={a.id} className="border-b border-border/40 last:border-0 hover:bg-secondary/40">
                              <td className="py-2 pr-2 font-medium text-foreground truncate max-w-[180px]">{a.name}</td>
                              <td className="py-2 pr-2">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(a.meta_account_id);
                                    toast.success('ID copiado');
                                  }}
                                  className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-primary transition-colors"
                                  title="Copiar ID"
                                >
                                  {a.meta_account_id}
                                  <Copy size={9} className="opacity-50" />
                                </button>
                              </td>
                              <td className="py-2 pr-2">
                                <span className={cn(
                                  'inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium border',
                                  isActive
                                    ? 'bg-success/10 text-success border-success/30'
                                    : 'bg-destructive/10 text-destructive border-destructive/30'
                                )}>
                                  {isActive ? <CheckCircle size={9} /> : <Ban size={9} />}
                                  {isActive ? 'Ativa' : (a.status || 'bloqueada')}
                                </span>
                              </td>
                              <td className="py-2 text-right tabular-nums font-semibold text-foreground">{fmt(a.spendPeriod)}</td>
                              <td className="py-2 text-right tabular-nums text-primary">{fmt(acctCommission)}</td>
                              <td className="py-2 text-right tabular-nums text-muted-foreground">{fmt(a.spendTotal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border font-semibold text-foreground">
                          <td colSpan={3} className="py-2 text-[10px] uppercase tracking-wider text-muted-foreground">Total</td>
                          <td className="py-2 text-right tabular-nums">
                            {fmt(accountsWithPeriodSpend.reduce((s, a) => s + a.spendPeriod, 0))}
                          </td>
                          <td className="py-2 text-right tabular-nums text-primary">
                            {fmt(accountsWithPeriodSpend.reduce((s, a) => s + a.spendPeriod * (basePct / 100), 0))}
                          </td>
                          <td className="py-2 text-right tabular-nums text-muted-foreground">
                            {fmt(accountsWithPeriodSpend.reduce((s, a) => s + a.spendTotal, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground/80 mt-2 leading-relaxed">
                  Comissão estimada usa o percentual base ({basePct}%) do cliente sobre o gasto por conta no período.
                  O valor final considera tiers de desconto por gasto semanal — ver Histórico ou Dashboard do cliente.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-[10px] text-muted-foreground/70 mt-2">
          Comissões geradas automaticamente a partir dos gastos sincronizados das contas de anúncio.
        </p>
      </div>
      <BillingAuditDialog
        open={showAudit}
        onOpenChange={setShowAudit}
        clientName={`${c.name}${c.companyName ? ' · ' + c.companyName : ''}`}
        audit={audit ?? null}
      />
    </motion.div>
  );
};

export default ClientCard;
