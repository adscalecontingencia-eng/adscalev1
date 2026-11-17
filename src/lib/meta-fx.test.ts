import { describe, it, expect } from 'vitest';
import { createFxConverter, convertInsightRow } from '../../supabase/functions/meta-sync/fx';

const rates = {
  '2026-11-13': { BRL: 5.6637 },
  '2026-11-16': { BRL: 5.7053 },
};
const fakeFetch = async (url: string) => ({
  ok: url.includes('frankfurter') && url.includes('BRL'),
  json: async () => ({ rates }),
});

describe('conversão de gasto Meta para USD', () => {
  it('converte R$ 5.700,12 de 16/11 pela cotação do dia (5,7053) para US$ 999,09', async () => {
    const fx = await createFxConverter(['BRL'], '2026-11-14', '2026-11-17', fakeFetch);
    const rate = fx.usdPerUnit('BRL', '2026-11-16')!;
    expect(convertInsightRow({ spend: 5700.12 }, 'BRL', rate).spend).toBe(999.09);
  });

  it('sábado usa a cotação da sexta anterior', async () => {
    const fx = await createFxConverter(['BRL'], '2026-11-14', '2026-11-17', fakeFetch);
    expect(fx.usdPerUnit('BRL', '2026-11-14')).toBeCloseTo(1 / 5.6637, 8);
  });

  it('conta em dólar não muda de valor', () => {
    expect(convertInsightRow({ spend: 120.5 }, 'USD', 1).spend).toBe(120.5);
  });

  it('sem cotação disponível devolve null (não salva como dólar)', async () => {
    const fx = await createFxConverter(['XYZ'], '2026-11-14', '2026-11-17', fakeFetch);
    expect(fx.usdPerUnit('XYZ', '2026-11-16')).toBeNull();
  });
});
