export type Tier = { name: string; min_weekly_spend: number; pct: number };

/** Picks the highest tier whose minimum weekly spend is reached. */
export function pickTier<T extends { min_weekly_spend: number }>(tiers: T[], spend: number): T | null {
  const sorted = [...tiers].sort((a, b) => Number(a.min_weekly_spend) - Number(b.min_weekly_spend));
  let hit: T | null = null;
  for (const t of sorted) if (spend >= Number(t.min_weekly_spend)) hit = t;
  return hit;
}

export function nextTier<T extends { min_weekly_spend: number }>(tiers: T[], spend: number): T | null {
  const sorted = [...tiers].sort((a, b) => Number(a.min_weekly_spend) - Number(b.min_weekly_spend));
  return sorted.find(t => Number(t.min_weekly_spend) > spend) ?? null;
}

/** Splits a client fee between AD SCALE (structure cost) and the agency margin. */
export function splitFee(spend: number, clientPct: number, adscalePct: number) {
  const r = (n: number) => Math.round(n * 100) / 100;
  const clientFee = r(spend * clientPct / 100);
  const adscaleFee = r(spend * adscalePct / 100);
  return { clientFee, adscaleFee, agencyMargin: r(clientFee - adscaleFee) };
}

/** Agency cannot charge less than the lowest AD SCALE rate without explicit subsidy. */
export function isBelowFloor(totalPct: number, platformPcts: number[], allowSubsidy: boolean) {
  if (allowSubsidy || platformPcts.length === 0) return false;
  return totalPct < Math.min(...platformPcts);
}
