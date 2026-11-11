import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

export interface CommissionTier {
  id?: string;
  min_spend: number;
  pct: number;
}

export const DEFAULT_TIERS: CommissionTier[] = [
  { min_spend: 20000, pct: 4 },
  { min_spend: 40000, pct: 3 },
  { min_spend: 80000, pct: 2 },
  { min_spend: 200000, pct: 1 },
];

export async function fetchCommissionTiers(): Promise<CommissionTier[]> {
  const { data, error } = await supabase
    .from('commission_tiers')
    .select('id, min_spend, pct')
    .order('min_spend', { ascending: true });
  if (error || !data || data.length === 0) return DEFAULT_TIERS;
  return data.map((d: any) => ({ id: d.id, min_spend: Number(d.min_spend), pct: Number(d.pct) }));
}

/** Base % of a client at the entry loyalty level (Standard). */
export const ENTRY_BASE_PCT = 5;

/**
 * Global weekly goals follow the client's loyalty level: a client whose base % is lower than
 * the entry level (Premium 4%, Elite 3%) gets every goal lowered by the same difference,
 * never below the lowest global goal and never above the client's own base.
 * Example (default goals 4/3/2/1%): Premium → 3/2/1/1%, Elite → 2/1/1/1%.
 */
export function loyaltyAdjustedTiers(tiers: CommissionTier[], basePct: number): CommissionTier[] {
  const base = Number(basePct) || 0;
  const offset = ENTRY_BASE_PCT - base;
  if (!tiers.length || base <= 0 || offset <= 0) return tiers;
  const floor = Math.min(...tiers.map(t => Number(t.pct)));
  return tiers.map(t => ({
    ...t,
    pct: Math.round(Math.min(base, Math.max(floor, Number(t.pct) - offset)) * 100) / 100,
  }));
}

/** Weekly goals for a client: own custom goals win; otherwise the global goals adjusted to the loyalty level. */
export function tiersForClient(customTiers: unknown, globalTiers: CommissionTier[], basePct: number): CommissionTier[] {
  if (Array.isArray(customTiers) && customTiers.length > 0) {
    return customTiers
      .filter((t: any) => Number.isFinite(Number(t?.min_spend)) && Number.isFinite(Number(t?.pct)))
      .map((t: any) => ({ min_spend: Number(t.min_spend), pct: Number(t.pct) }));
  }
  return loyaltyAdjustedTiers(globalTiers, basePct);
}

/** Returns pct given a weekly spend. tiers must be sorted asc by min_spend. */
export function getTierPctFromTiers(weekSpend: number, basePct: number, tiers: CommissionTier[]): number {
  // iterate from highest min to lowest; pick first whose min is exceeded
  const desc = [...tiers].sort((a, b) => b.min_spend - a.min_spend);
  for (const t of desc) if (weekSpend > t.min_spend) return t.pct;
  return basePct;
}

export function useCommissionTiers() {
  const [tiers, setTiers] = useState<CommissionTier[]>(DEFAULT_TIERS);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    const t = await fetchCommissionTiers();
    setTiers(t);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);
  return { tiers, loading, reload };
}

/**
 * Detects misconfigured weekly goals: once sorted by spend, each higher goal must charge a
 * lower % than the previous one (and never more than the client's base %). A typo such as
 * 10,000 instead of 100,000 makes a lower spend get a smaller fee than a higher one.
 * Returns a human-readable message or null when the goals are consistent.
 */
export function tierOrderProblem(tiers: CommissionTier[], basePct?: number): string | null {
  const clean = tiers
    .filter(t => Number.isFinite(Number(t.min_spend)) && Number.isFinite(Number(t.pct)))
    .map(t => ({ min_spend: Number(t.min_spend), pct: Number(t.pct) }))
    .sort((a, b) => a.min_spend - b.min_spend);
  const usd = (v: number) => `US$ ${v.toLocaleString('en-US')}`;
  for (let i = 0; i < clean.length; i++) {
    const t = clean[i];
    if (t.min_spend <= 0 || t.pct <= 0) return 'Cada meta precisa de gasto e % maiores que zero.';
    if (i > 0 && t.min_spend === clean[i - 1].min_spend) return `Há duas metas com o mesmo gasto (${usd(t.min_spend)}).`;
    if (i > 0 && t.pct >= clean[i - 1].pct) {
      return `A meta de ${usd(t.min_spend)} (${t.pct}%) precisa ter % menor que a meta de ${usd(clean[i - 1].min_spend)} (${clean[i - 1].pct}%).`;
    }
    if (i === 0 && basePct && t.pct > basePct) return `A primeira meta (${t.pct}%) não pode ser maior que a % base do cliente (${basePct}%).`;
  }
  return null;
}

/**
 * Estimated commission for the spend inside [start, end], using the weekly-goal rate of each
 * Friday→Thursday week (the rate depends on the WHOLE week's spend, like the billing engine).
 */
export function estimateCommissionInRange(
  spendByDay: { date: string; spend: number }[],
  start: Date,
  end: Date,
  rateForWeekSpend: (weekSpend: number) => number,
): { commission: number; rates: number[] } {
  const weekKey = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    const day = new Date(y, m - 1, d);
    const back = (day.getDay() - 5 + 7) % 7; // Friday = 5
    day.setDate(day.getDate() - back);
    return day.getTime();
  };
  const weekTotal = new Map<number, number>();
  const weekInRange = new Map<number, number>();
  const startTs = start.getTime();
  const endTs = end.getTime();
  for (const r of spendByDay) {
    const iso = String(r.date || '').slice(0, 10);
    if (!iso) continue;
    const k = weekKey(iso);
    const spend = Number(r.spend || 0);
    weekTotal.set(k, (weekTotal.get(k) || 0) + spend);
    const [y, m, d] = iso.split('-').map(Number);
    const ts = new Date(y, m - 1, d).getTime();
    if (ts >= startTs && ts <= endTs) weekInRange.set(k, (weekInRange.get(k) || 0) + spend);
  }
  let commission = 0;
  const rates = new Set<number>();
  weekInRange.forEach((spend, k) => {
    const rate = rateForWeekSpend(weekTotal.get(k) || 0);
    if (spend > 0) rates.add(rate);
    commission += spend * (rate / 100);
  });
  return { commission, rates: Array.from(rates).sort((a, b) => b - a) };
}
