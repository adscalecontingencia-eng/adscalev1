import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { DEFAULT_TIERS, getTierPctFromTiers, tiersForClient } from './commission-tiers';

const pctAt = (spend: number, base: number) => getTierPctFromTiers(spend, base, tiersForClient(null, DEFAULT_TIERS, base));

describe('weekly goals follow the loyalty level', () => {
  it('Standard (5%) keeps the global goals: first goal is 4%', () => {
    expect(pctAt(25000, 5)).toBe(4);
  });
  it('Premium (4%) starts the first goal at 3%', () => {
    expect(pctAt(25000, 4)).toBe(3);
    expect(pctAt(45000, 4)).toBe(2);
  });
  it('Elite (3%) starts the first goal at 2%', () => {
    expect(pctAt(25000, 3)).toBe(2);
  });
  it('never goes below the lowest global goal (1%)', () => {
    expect(pctAt(250000, 3)).toBe(1);
  });
  it('below the first goal the client pays its own base', () => {
    expect(pctAt(10000, 4)).toBe(4);
  });
  it('custom goals set for a client are not adjusted', () => {
    const custom = [{ min_spend: 20000, pct: 3.5 }];
    expect(getTierPctFromTiers(25000, 4, tiersForClient(custom, DEFAULT_TIERS, 4))).toBe(3.5);
  });
});
