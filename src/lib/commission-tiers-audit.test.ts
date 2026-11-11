import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { estimateCommissionInRange, getTierPctFromTiers, tierOrderProblem } from './commission-tiers';

describe('weekly goals must lower the % as spend grows', () => {
  it('rejects a goal typed as 10,000 at 2% below a 20,000 goal at 4%', () => {
    const typo = [
      { min_spend: 20000, pct: 4 }, { min_spend: 60000, pct: 3 },
      { min_spend: 10000, pct: 2 }, { min_spend: 150000, pct: 1.5 },
    ];
    expect(tierOrderProblem(typo, 5)).not.toBeNull();
  });
  it('accepts 20k 4% / 60k 3% / 100k 2% / 150k 1.5%', () => {
    const ok = [
      { min_spend: 20000, pct: 4 }, { min_spend: 60000, pct: 3 },
      { min_spend: 100000, pct: 2 }, { min_spend: 150000, pct: 1.5 },
    ];
    expect(tierOrderProblem(ok, 5)).toBeNull();
  });
});

describe('estimated commission uses the week goal, not the flat base', () => {
  const tiers = [{ min_spend: 20000, pct: 4 }];
  const rate = (s: number) => getTierPctFromTiers(s, 5, tiers);
  it('week under the first goal pays the 5% base', () => {
    const rows = [{ date: '2026-11-06', spend: 10000 }];
    const r = estimateCommissionInRange(rows, new Date(2026, 10, 6), new Date(2026, 10, 12, 23, 59), rate);
    expect(r.commission).toBeCloseTo(500, 2);
  });
  it('week above 20k pays 4% on the whole week', () => {
    const rows = [{ date: '2026-11-06', spend: 15000 }, { date: '2026-11-08', spend: 10000 }];
    const r = estimateCommissionInRange(rows, new Date(2026, 10, 6), new Date(2026, 10, 12, 23, 59), rate);
    expect(r.commission).toBeCloseTo(1000, 2);
    expect(r.rates).toEqual([4]);
  });
  it('a single day inside a 4% week uses 4%', () => {
    const rows = [{ date: '2026-11-06', spend: 15000 }, { date: '2026-11-08', spend: 10000 }];
    const r = estimateCommissionInRange(rows, new Date(2026, 10, 8), new Date(2026, 10, 8, 23, 59), rate);
    expect(r.commission).toBeCloseTo(400, 2);
  });
});

describe('one account inside a week that hit the goal', () => {
  it('uses the client week total to pick the %', () => {
    const rate = (s: number) => getTierPctFromTiers(s, 5, [{ min_spend: 20000, pct: 4 }]);
    const all = [{ date: '2026-11-06', spend: 15000 }, { date: '2026-11-07', spend: 10000 }];
    const acct = [{ date: '2026-11-07', spend: 10000 }];
    const r = estimateCommissionInRange(acct, new Date(2026, 10, 6), new Date(2026, 10, 12, 23, 59), rate, all);
    expect(r.commission).toBeCloseTo(400, 2);
  });
});
