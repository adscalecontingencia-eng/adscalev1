// Saldo, gasto total e limite de gasto vêm do Meta na moeda da própria conta
// (BRL, EUR...). Só os gastos diários (meta_ad_insights) são convertidos para USD.
// Use estes helpers para nunca mostrar reais com o símbolo de dólar.

export function formatAccountMoney(value: unknown, currency?: string | null) {
  const cur = String(currency || 'USD').toUpperCase();
  const n = Number(value || 0);
  try {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: cur });
  } catch {
    return `${cur} ${n.toFixed(2)}`;
  }
}

/** Soma valores separando por moeda: "US$ 120,00 + R$ 58,46". */
export function formatSumByCurrency(items: Array<{ value: unknown; currency?: string | null }>) {
  const totals = new Map<string, number>();
  for (const it of items) {
    const cur = String(it.currency || 'USD').toUpperCase();
    totals.set(cur, (totals.get(cur) || 0) + Number(it.value || 0));
  }
  if (totals.size === 0) return formatAccountMoney(0, 'USD');
  const order = [...totals.keys()].sort((a, b) => (a === 'USD' ? -1 : b === 'USD' ? 1 : a.localeCompare(b)));
  return order.map((c) => formatAccountMoney(totals.get(c), c)).join(' + ');
}
