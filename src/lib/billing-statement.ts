// Extrato diário por conta de anúncio da semana de cobrança (sexta → quinta).
// IMPORTANTE: as datas dos insights vêm da Meta já no FUSO DA CONTA de anúncio
// (time_increment=1 é sempre reportado no timezone do ad account). Por isso o
// extrato bate 1:1 com o Gerenciador quando a conta é aberta individualmente.

import { startOfWeek, endOfWeek, format } from 'date-fns';

export interface StatementAccount {
  id: string;
  name?: string | null;
  meta_account_id?: string | null;
  timezone_name?: string | null;
  currency?: string | null;
  last_synced_at?: string | null;
  archived_at?: string | null;
}

export interface StatementInsight {
  ad_account_id: string;
  date: string;
  spend: number | string | null;
  impressions?: number | null;
  clicks?: number | null;
}

export interface StatementDay {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
}

export interface StatementAccountGroup {
  account: StatementAccount;
  days: StatementDay[];
  total: number;
}

export interface WeekStatement {
  weekStart: Date;
  weekEnd: Date;
  weekStartISO: string;
  weekEndISO: string;
  groups: StatementAccountGroup[];
  totalSpend: number;
  commissionPct: number;
  commissionAmount: number;
  timezones: string[];
}

export const fmtISODate = (d: Date) => format(d, 'yyyy-MM-dd');

/** Semana de cobrança da AD SCALE: sexta → quinta. */
export function billingWeekOf(date: Date) {
  const start = startOfWeek(date, { weekStartsOn: 5 });
  const end = endOfWeek(date, { weekStartsOn: 5 });
  return { start, end };
}

export function buildWeekStatement(params: {
  reference: Date;
  accounts: StatementAccount[];
  insights: StatementInsight[];
  basePct: number;
  getTierPct?: (weekSpend: number, basePct: number) => number;
}): WeekStatement {
  const { reference, accounts, insights, basePct, getTierPct } = params;
  const { start, end } = billingWeekOf(reference);
  const startISO = fmtISODate(start);
  const endISO = fmtISODate(end);

  const byAccount = new Map<string, StatementDay[]>();
  insights.forEach((row) => {
    const date = String(row.date).slice(0, 10);
    if (date < startISO || date > endISO) return;
    const list = byAccount.get(row.ad_account_id) || [];
    list.push({
      date,
      spend: Number(row.spend || 0),
      impressions: Number(row.impressions || 0),
      clicks: Number(row.clicks || 0),
    });
    byAccount.set(row.ad_account_id, list);
  });

  const groups: StatementAccountGroup[] = accounts
    .map((account) => {
      const days = (byAccount.get(account.id) || []).sort((a, b) => a.date.localeCompare(b.date));
      return { account, days, total: days.reduce((s, d) => s + d.spend, 0) };
    })
    .filter((g) => g.days.length > 0)
    .sort((a, b) => b.total - a.total);

  const totalSpend = groups.reduce((s, g) => s + g.total, 0);
  const commissionPct = getTierPct ? getTierPct(totalSpend, basePct) : basePct;
  const commissionAmount = totalSpend * (commissionPct / 100);
  const timezones = Array.from(
    new Set(groups.map((g) => g.account.timezone_name).filter(Boolean) as string[])
  );

  return {
    weekStart: start,
    weekEnd: end,
    weekStartISO: startISO,
    weekEndISO: endISO,
    groups,
    totalSpend,
    commissionPct,
    commissionAmount,
    timezones,
  };
}

/** Itens (linha a linha) prontos para congelar num snapshot ou exportar. */
export function statementItems(st: WeekStatement) {
  const items: {
    ad_account_id: string;
    account_name: string;
    meta_account_id: string | null;
    timezone: string | null;
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
  }[] = [];
  st.groups.forEach((g) => {
    g.days.forEach((d) => {
      items.push({
        ad_account_id: g.account.id,
        account_name: g.account.name || g.account.meta_account_id || g.account.id,
        meta_account_id: g.account.meta_account_id || null,
        timezone: g.account.timezone_name || null,
        date: d.date,
        spend: d.spend,
        impressions: d.impressions,
        clicks: d.clicks,
      });
    });
  });
  return items;
}

export function statementToCSV(st: WeekStatement, clientName: string): string {
  const rows: string[][] = [
    ['Cliente', clientName],
    ['Semana de cobranca', `${st.weekStartISO} a ${st.weekEndISO}`],
    ['Fuso das contas', st.timezones.join(' | ') || 'n/d'],
    ['Gasto total (USD)', st.totalSpend.toFixed(2)],
    ['Percentual aplicado', `${st.commissionPct}%`],
    ['Comissao (USD)', st.commissionAmount.toFixed(2)],
    [],
    ['Conta', 'ID Meta', 'Fuso', 'Data', 'Gasto (USD)', 'Impressoes', 'Cliques'],
  ];
  statementItems(st).forEach((i) => {
    rows.push([
      i.account_name,
      i.meta_account_id || '',
      i.timezone || '',
      i.date,
      i.spend.toFixed(2),
      String(i.impressions),
      String(i.clicks),
    ]);
  });
  return rows
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
