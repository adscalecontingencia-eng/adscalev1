import { startOfDay, endOfDay, startOfWeek, subDays, isWithinInterval } from 'date-fns';
import { parseDateLocal } from '@/lib/date-utils';

export interface SpendPoint { date: string; spend: number }
export interface AccountLike { id: string; spendByDay: SpendPoint[] }

/**
 * Retorna a janela parcial da semana atual (sex → agora) e a mesma janela
 * parcial da semana anterior (sex-1sem → mesmo dia/hora da semana anterior).
 * Comparação justa dia-a-dia.
 */
export function getPartialWeekRanges(now: Date = new Date()) {
  const currentStart = startOfDay(startOfWeek(now, { weekStartsOn: 5 }));
  const currentEnd = endOfDay(now);
  const previousStart = startOfDay(subDays(currentStart, 7));
  const previousEnd = endOfDay(subDays(now, 7));
  return {
    current: { start: currentStart, end: currentEnd },
    previous: { start: previousStart, end: previousEnd },
  };
}

const sumInRange = (rows: SpendPoint[], start: Date, end: Date) =>
  rows.reduce((s, r) => {
    const d = parseDateLocal(r.date);
    return isWithinInterval(d, { start, end }) ? s + (r.spend || 0) : s;
  }, 0);

const countActiveAccounts = (accounts: AccountLike[], start: Date, end: Date) => {
  let n = 0;
  for (const a of accounts) {
    if (sumInRange(a.spendByDay, start, end) > 0) n++;
  }
  return n;
};

export interface WeekCompareMetrics {
  spend: number;
  commission: number;
  activeAccounts: number;
}

export interface WeekCompareResult {
  current: WeekCompareMetrics;
  previous: WeekCompareMetrics;
  ranges: ReturnType<typeof getPartialWeekRanges>;
}

/** Comparação para um único cliente. Passe accounts quando disponíveis para contagem
 *  precisa de contas ativas; caso contrário passe []. */
export function computeClientWeekCompare(params: {
  spendByDay: SpendPoint[];
  accounts: AccountLike[];
  percentage: number; // 0 quando não for aluguel
  now?: Date;
}): WeekCompareResult {
  const { spendByDay, accounts, percentage } = params;
  const ranges = getPartialWeekRanges(params.now);
  const pct = (percentage || 0) / 100;

  const curSpend = sumInRange(spendByDay, ranges.current.start, ranges.current.end);
  const prevSpend = sumInRange(spendByDay, ranges.previous.start, ranges.previous.end);

  return {
    current: {
      spend: curSpend,
      commission: curSpend * pct,
      activeAccounts: countActiveAccounts(accounts, ranges.current.start, ranges.current.end),
    },
    previous: {
      spend: prevSpend,
      commission: prevSpend * pct,
      activeAccounts: countActiveAccounts(accounts, ranges.previous.start, ranges.previous.end),
    },
    ranges,
  };
}

/** Comparação agregada para vários clientes. */
export function computeAggregateWeekCompare(
  entries: Array<{ spendByDay: SpendPoint[]; accounts: AccountLike[]; percentage: number }>,
  now?: Date,
): WeekCompareResult {
  const ranges = getPartialWeekRanges(now);
  const agg: WeekCompareResult = {
    current: { spend: 0, commission: 0, activeAccounts: 0 },
    previous: { spend: 0, commission: 0, activeAccounts: 0 },
    ranges,
  };
  for (const e of entries) {
    const r = computeClientWeekCompare({ ...e, now });
    agg.current.spend += r.current.spend;
    agg.current.commission += r.current.commission;
    agg.current.activeAccounts += r.current.activeAccounts;
    agg.previous.spend += r.previous.spend;
    agg.previous.commission += r.previous.commission;
    agg.previous.activeAccounts += r.previous.activeAccounts;
  }
  return agg;
}

export const pctDelta = (current: number, previous: number): number | null => {
  if (previous === 0) return current === 0 ? 0 : null; // null = sem base para %
  return ((current - previous) / previous) * 100;
};
