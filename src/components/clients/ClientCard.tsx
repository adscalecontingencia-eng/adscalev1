import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Eye,
  Edit2,
  Trash2,
  CheckCircle,
  History,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CircleDot,
  CalendarIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDateLocal } from '@/lib/date-utils';

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

interface Props {
  client: ClientLite;
  totalAdSpend: number;
  comissaoPendente: number;
  comissaoPaga: number;
  saldoPendente: number;
  status: ClientStatus;
  spendByDay: { date: string; spend: number }[];
  isAdmin: boolean;
  showPayForm: boolean;
  paidAmount: string;
  setPaidAmount: (s: string) => void;
  paidDate: Date;
  setPaidDate: (d: Date) => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
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
  tone?: 'default' | 'primary' | 'warning' | 'success';
  highlight?: boolean;
  right?: React.ReactNode;
}> = ({ icon, label, value, tone = 'default', highlight, right }) => {
  const toneClass = {
    default: 'text-foreground',
    primary: 'text-primary',
    warning: 'text-warning',
    success: 'text-success',
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

export const ClientCard: React.FC<Props> = (props) => {
  const {
    client: c,
    totalAdSpend,
    comissaoPendente,
    comissaoPaga,
    saldoPendente,
    status,
    spendByDay,
    isAdmin,
    showPayForm,
    paidAmount,
    setPaidAmount,
    paidDate,
    setPaidDate,
    onView,
    onEdit,
    onDelete,
    onTogglePayForm,
    onSubmitPay,
    onOpenHistory,
  } = props;

  // Build last 14 days sparkline (filling zeros)
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

  const planCredit = c.planCredit || 0;
  const availableAccounts = c.adAccounts - c.usedAccounts - c.blockedAccounts;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl overflow-hidden border-glow"
    >
      <div className="p-4">
        {/* Header: identidade */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">#{c.number}</span>
              <h4 className="font-semibold text-sm">{c.name}</h4>
              <span
                className={cn(
                  'text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-medium',
                  c.clientType === 'venda' ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary'
                )}
              >
                {c.clientType === 'venda' ? 'Venda' : 'Aluguel'}
              </span>
              <StatusBadge status={status} />
            </div>
            {/* Sub-header: metadados densos */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1.5">
              {c.companyName && <span className="text-foreground/80">{c.companyName}</span>}
              {c.email && <span className="truncate max-w-[220px]">{c.email}</span>}
              <span className="text-primary/90">
                {c.clientType === 'venda'
                  ? `Fixo ${fmt(c.fixedValue || 0)}`
                  : `${c.percentageValue || 0}% base`}
              </span>
              {c.clientType === 'aluguel' && (
                <span>
                  {availableAccounts} {availableAccounts === 1 ? 'conta disponível' : 'contas disponíveis'}
                </span>
              )}
              {planCredit > 0 && (
                <span className="text-success">Crédito {fmt(planCredit)}</span>
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
            <button
              onClick={onDelete}
              title="Excluir"
              className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat
            icon={<DollarSign size={11} />}
            label="Gasto em Ads"
            value={fmt(totalAdSpend)}
            right={<Sparkline data={last14} />}
          />
          <Stat icon={<TrendingUp size={11} />} label="Comissão Pendente" value={fmt(comissaoPendente)} tone="primary" />
          <Stat icon={<CheckCircle size={11} />} label="Comissão Paga" value={fmt(comissaoPaga)} tone="success" />
          <Stat
            icon={saldoPendente > 0 ? <AlertTriangle size={11} /> : <CircleDot size={11} />}
            label="Saldo Pendente"
            value={fmt(saldoPendente)}
            tone={saldoPendente > 0 ? 'warning' : 'success'}
            highlight={saldoPendente > 0}
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
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 text-xs bg-secondary text-muted-foreground px-3 py-1.5 rounded-lg hover:text-foreground border border-border transition-colors ml-auto"
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
              className="bg-success text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 whitespace-nowrap"
            >
              Registrar
            </button>
          </motion.div>
        )}

        <p className="text-[10px] text-muted-foreground/70 mt-2">
          Comissões geradas automaticamente a partir dos gastos sincronizados das contas de anúncio.
        </p>
      </div>
    </motion.div>
  );
};

export default ClientCard;
