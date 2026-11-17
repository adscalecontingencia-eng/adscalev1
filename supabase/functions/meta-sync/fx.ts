// Conversão de gastos do Meta para USD.
// O Meta devolve spend/cpm/cpc/revenue na moeda da conta (BRL, EUR...).
// Todo o sistema (dashboards, comissões, saldo acumulado) trabalha em USD,
// então convertemos cada dia pela cotação daquele dia antes de salvar.

type FetchLike = (url: string) => Promise<{ ok: boolean; json: () => Promise<any> }>;

const addDays = (iso: string, n: number) =>
  new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

/**
 * Cria um conversor para o intervalo [since, until]. `usdPerUnit(cur, date)`
 * devolve quantos dólares vale 1 unidade da moeda naquele dia (fim de semana
 * e feriado usam o último dia útil anterior). Devolve null se não houver cotação.
 */
export async function createFxConverter(
  currencies: string[],
  since: string,
  until: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike,
) {
  const series = new Map<string, Array<[string, number]>>(); // cur -> [date, usdPerUnit] ordenado
  const latest = new Map<string, number>();
  const wanted = [...new Set(currencies.map((c) => String(c || "USD").toUpperCase()))].filter((c) => c !== "USD");

  for (const cur of wanted) {
    try {
      const r = await fetchFn(`https://api.frankfurter.dev/v1/${addDays(since, -7)}..${until}?base=USD&symbols=${cur}`);
      if (r.ok) {
        const d = await r.json();
        const pts: Array<[string, number]> = Object.entries(d?.rates || {})
          .map(([date, v]: [string, any]) => [date, Number(v?.[cur])] as [string, number])
          .filter(([, perUsd]) => perUsd > 0)
          .map(([date, perUsd]) => [date, 1 / perUsd] as [string, number])
          .sort((a, b) => a[0].localeCompare(b[0]));
        if (pts.length) series.set(cur, pts);
      }
    } catch { /* tenta fonte alternativa */ }
  }

  const missing = wanted.filter((c) => !series.has(c));
  if (missing.length) {
    try {
      const r = await fetchFn("https://open.er-api.com/v6/latest/USD");
      if (r.ok) {
        const d = await r.json();
        for (const c of missing) {
          const perUsd = Number(d?.rates?.[c]);
          if (perUsd > 0) latest.set(c, 1 / perUsd);
        }
      }
    } catch { /* sem cotação */ }
  }

  const usdPerUnit = (currency: string | null | undefined, date: string): number | null => {
    const cur = String(currency || "USD").toUpperCase();
    if (cur === "USD") return 1;
    const pts = series.get(cur);
    if (pts) {
      let pick: number | null = null;
      for (const [d, v] of pts) {
        if (d <= date) pick = v; else break;
      }
      return pick ?? pts[0][1];
    }
    return latest.get(cur) ?? null;
  };

  return { usdPerUnit };
}

/** Converte um dia de insights para USD, guardando o valor original. */
export function convertInsightRow<T extends Record<string, any>>(row: T, currency: string | null | undefined, rate: number) {
  const cur = String(currency || "USD").toUpperCase();
  const round = (v: unknown) => Math.round(Number(v || 0) * rate * 100) / 100;
  return {
    ...row,
    spend_original: Number(row.spend || 0),
    currency: cur,
    fx_rate: rate,
    spend: cur === "USD" ? Number(row.spend || 0) : round(row.spend),
    cpm: cur === "USD" ? Number(row.cpm || 0) : round(row.cpm),
    cpc: cur === "USD" ? Number(row.cpc || 0) : round(row.cpc),
    revenue: cur === "USD" ? Number(row.revenue || 0) : round(row.revenue),
  };
}
