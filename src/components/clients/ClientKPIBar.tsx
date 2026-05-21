import React from 'react';
import { Users, DollarSign, AlertTriangle, CheckCircle2, Wallet, AlertOctagon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPI {
  totalClients: number;
  aluguelCount: number;
  vendaCount: number;
  totalAdSpend: number;
  totalPendente: number;
  totalAtrasado: number;
  totalPaga: number;
  inadimplentes: number;
}

const fmt = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const Card: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'primary' | 'warning' | 'success' | 'destructive';
}> = ({ icon, label, value, hint, tone = 'default' }) => {
  const toneClass = {
    default: 'text-foreground',
    primary: 'text-primary',
    warning: 'text-warning',
    success: 'text-success',
    destructive: 'text-destructive',
  }[tone];
  return (
    <div className="bg-card/60 backdrop-blur border border-border rounded-xl p-4 flex flex-col gap-2 hover:border-primary/40 transition-colors">
      <div className="flex items-center gap-2 text-muted-foreground text-[10px] uppercase tracking-[0.18em]">
        <span className={cn('p-1.5 rounded-md bg-secondary', toneClass)}>{icon}</span>
        {label}
      </div>
      <div className={cn('font-display text-2xl font-bold leading-none', toneClass)}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
};

export const ClientKPIBar: React.FC<{ kpi: KPI }> = ({ kpi }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <Card
        icon={<Users size={14} />}
        label="Clientes"
        value={String(kpi.totalClients)}
        hint={`${kpi.aluguelCount} aluguel · ${kpi.vendaCount} venda`}
      />
      <Card
        icon={<DollarSign size={14} />}
        label="Gasto em Ads"
        value={fmt(kpi.totalAdSpend)}
        hint="no período selecionado"
      />
      <Card
        icon={<AlertTriangle size={14} />}
        label="Saldo Pendente"
        value={fmt(kpi.totalPendente)}
        hint="semana corrente"
        tone="warning"
      />
      <Card
        icon={<AlertOctagon size={14} />}
        label="Saldo Atrasado"
        value={fmt(kpi.totalAtrasado)}
        hint="vencido após sexta"
        tone={kpi.totalAtrasado > 0 ? 'destructive' : 'success'}
      />
      <Card
        icon={<CheckCircle2 size={14} />}
        label="Comissão Paga"
        value={fmt(kpi.totalPaga)}
        hint="no período"
        tone="success"
      />
      <Card
        icon={<Wallet size={14} />}
        label="Inadimplentes"
        value={String(kpi.inadimplentes)}
        hint="clientes com atraso"
        tone={kpi.inadimplentes > 0 ? 'destructive' : 'success'}
      />
    </div>
  );
};

export default ClientKPIBar;
