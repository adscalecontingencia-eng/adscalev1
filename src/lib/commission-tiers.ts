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
