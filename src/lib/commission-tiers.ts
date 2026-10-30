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
