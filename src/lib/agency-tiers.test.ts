import { describe, it, expect } from 'vitest';
import { pickTier, nextTier, splitFee, isBelowFloor } from './agency-tiers';

const platform = [
  { name: 'T1', min_weekly_spend: 0, pct: 3 },
  { name: 'T2', min_weekly_spend: 25000, pct: 2.5 },
  { name: 'T3', min_weekly_spend: 75000, pct: 2 },
  { name: 'T4', min_weekly_spend: 150000, pct: 1.5 },
];

describe('agency tiers', () => {
  it('US$ 38.450/semana cai no Tier 2 (2,5%)', () => {
    expect(pickTier(platform, 38450)?.pct).toBe(2.5);
    expect(nextTier(platform, 38450)?.min_weekly_spend).toBe(75000);
  });
  it('acima de US$ 150.000 a taxa AD SCALE é 1,5%', () => {
    expect(pickTier(platform, 200000)?.pct).toBe(1.5);
  });
  it('5% sobre US$ 500: AD SCALE 3% = US$ 15, agência fica com US$ 10', () => {
    expect(splitFee(500, 5, 3)).toEqual({ clientFee: 25, adscaleFee: 15, agencyMargin: 10 });
  });
  it('bloqueia taxa abaixo do piso AD SCALE sem subsídio', () => {
    expect(isBelowFloor(1.2, [3, 2.5, 2, 1.5], false)).toBe(true);
    expect(isBelowFloor(1.2, [3, 2.5, 2, 1.5], true)).toBe(false);
  });
});
