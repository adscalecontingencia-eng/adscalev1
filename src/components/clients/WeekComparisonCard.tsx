import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowDownRight, ArrowUpRight, Minus, CalendarRange, DollarSign, Zap, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WeekCompareResult, pctDelta } from '@/lib/week-compare';

const fmtUSD = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

interface Props {
  data: WeekCompareResult;
  title?: string;
  subtitle?: string;
  showCommission?: boolean;
  compact?: boolean;
  className?: string;
}

const DeltaBadge: React.FC<{ current: number; previous: number; invert?: boolean }> = ({
  current,
  previous,
  invert,
}) => {
  const delta = pctDelta(current, previous);
  if (delta === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">
        <Minus size={10} /> novo
      </span>
    );
  }
  const up = delta > 0.05;
  const down = delta < -0.05;
  const positive = invert ? down : up;
  const negative = invert ? up : down;
  const cls = positive
    ? 'bg-success/15 text-success border-success/30'
    : negative
      ? 'bg-destructive/15 text-destructive border-destructive/30'
      : 'bg-secondary/60 text-muted-foreground border-border';
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border', cls)}>
      <Icon size={10} />
      {delta > 0 ? '+' : ''}
      {delta.toFixed(1)}%
    </span>
  );
};

const Metric: React.FC<{
  icon: React.ReactNode;
  label: string;
  current: string;
  previous: string;
  currentNum: number;
  previousNum: number;
  tone?: 'default' | 'primary' | 'warning';
}> = ({ icon, label, current, previous, currentNum, previousNum, tone = 'default' }) => {
  const toneClass = {
    default: 'text-foreground',
    primary: 'text-primary',
    warning: 'text-warning',
  }[tone];
  return (
    <div className="bg-secondary/40 rounded-lg p-3 border border-border/40">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
        <span className={toneClass}>{icon}</span>
        <span className="truncate">{label}</span>
        <span className="ml-auto">
          <DeltaBadge current={currentNum} previous={previousNum} />
        </span>
      </div>
      <div className={cn('text-base font-bold leading-tight', toneClass)}>{current}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        Semana anterior: <span className="text-foreground/80">{previous}</span>
      </div>
    </div>
  );
};

export const WeekComparisonCard: React.FC<Props> = ({
  data,
  title = 'Comparativo semanal',
  subtitle,
  showCommission = true,
  compact = false,
  className,
}) => {
  const { current, previous, ranges } = data;
  const rangeLabel = `${format(ranges.current.start, "dd/MM", { locale: ptBR })} – ${format(ranges.current.end, "dd/MM", { locale: ptBR })} vs ${format(ranges.previous.start, "dd/MM", { locale: ptBR })} – ${format(ranges.previous.end, "dd/MM", { locale: ptBR })}`;

  return (
    <div
      className={cn(
        'bg-card/60 backdrop-blur border border-border rounded-xl',
        compact ? 'p-3' : 'p-4',
        className,
      )}
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="p-1.5 rounded-md bg-secondary text-primary">
            <CalendarRange size={13} />
          </span>
          {title}
        </div>
        <span className="text-[10px] text-muted-foreground ml-auto">{rangeLabel}</span>
      </div>
      {subtitle && <p className="text-[11px] text-muted-foreground mb-3 -mt-1">{subtitle}</p>}
      <div className={cn('grid gap-2', showCommission ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2')}>
        <Metric
          icon={<DollarSign size={12} />}
          label="Gasto em Ads"
          current={fmtUSD(current.spend)}
          previous={fmtUSD(previous.spend)}
          currentNum={current.spend}
          previousNum={previous.spend}
        />
        {showCommission && (
          <Metric
            icon={<Zap size={12} />}
            label="Comissão est."
            current={fmtUSD(current.commission)}
            previous={fmtUSD(previous.commission)}
            currentNum={current.commission}
            previousNum={previous.commission}
            tone="primary"
          />
        )}
        <Metric
          icon={<Layers size={12} />}
          label="Contas com gasto"
          current={String(current.activeAccounts)}
          previous={String(previous.activeAccounts)}
          currentNum={current.activeAccounts}
          previousNum={previous.activeAccounts}
        />
      </div>
    </div>
  );
};

export default WeekComparisonCard;
