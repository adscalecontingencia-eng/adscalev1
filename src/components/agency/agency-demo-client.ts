// Simulated data for the Agência Demo end-client logins (presentation only).
// Never seeds real rows: the ClientDashboard swaps these in client-side.
import { format, subDays, startOfWeek, addDays } from 'date-fns';
import { DEMO_ACCOUNTS, DEMO_LINKS } from './agency-accounts';

/** demo end-client email -> index of the demo sub-client (same order as DEMO_LINKS). */
export const DEMO_SUBCLIENT_EMAILS: Record<string, { index: number; pct: number }> = {
  'demo.infoprodutor@adscalehub.com': { index: 0, pct: 5 },
  'demo.loja@adscalehub.com': { index: 1, pct: 4.5 },
};

export const isDemoSubClient = (email?: string | null) => !!email && !!DEMO_SUBCLIENT_EMAILS[email.toLowerCase()];

export function buildDemoClientData(email: string, clientId: string) {
  const cfg = DEMO_SUBCLIENT_EMAILS[email.toLowerCase()];
  const accs = DEMO_ACCOUNTS.filter(a => DEMO_LINKS[a.id] === cfg.index);
  const since = format(subDays(new Date(), 60), 'yyyy-MM-dd');
  const assignments = accs.map(a => ({
    id: `demo-asg-${a.id}`, ad_account_id: a.id, client_id: clientId, active: true, effective_from: since, effective_to: null,
    ad_account: {
      ...a, status: a.account_status === 2 ? 'blocked' : 'active', disable_reason: a.account_status === 2 ? 1 : 0,
      archived_at: null, owner_business_name: 'Agência Demo',
    },
  }));
  const insights: any[] = [];
  accs.forEach((a, ai) => {
    const daily = (a.week_spend || 0) / 7;
    if (!daily) return;
    for (let d = 0; d < 60; d++) {
      const wave = 0.75 + 0.5 * Math.abs(Math.sin((d + 1) * (ai + 2) * 0.7));
      const spend = Math.round(daily * wave * 100) / 100;
      const impressions = Math.round(spend * 95);
      const clicks = Math.round(impressions * 0.018);
      const purchases = Math.round(spend / 38);
      insights.push({
        ad_account_id: a.id, date: format(subDays(new Date(), d), 'yyyy-MM-dd'), spend, impressions, clicks,
        cpm: impressions ? (spend / impressions) * 1000 : 0, cpc: clicks ? spend / clicks : 0, ctr: impressions ? (clicks / impressions) * 100 : 0,
        reach: Math.round(impressions * 0.62), purchases, revenue: Math.round(purchases * 112 * 100) / 100,
      });
    }
  });
  // Last 4 closed Friday→Thursday weeks billed and paid.
  const commissions: any[] = [];
  const thisWeek = startOfWeek(new Date(), { weekStartsOn: 5 });
  for (let w = 1; w <= 4; w++) {
    const start = addDays(thisWeek, -7 * w), end = addDays(start, 6);
    const s = format(start, 'yyyy-MM-dd'), e = format(end, 'yyyy-MM-dd');
    const spend = insights.filter(i => i.date >= s && i.date <= e).reduce((t, i) => t + i.spend, 0);
    const amount = Math.round(spend * cfg.pct) / 100;
    commissions.push({ id: `demo-wb-${w}`, client_id: clientId, date: e, amount, type: 'weekly_billing', ad_spend: spend, billing_week_start: s, billing_week_end: e, is_weekly_billing: true, percentual_aplicado: cfg.pct, valor_pago: amount, valor_pendente: 0, status: 'pago', note: 'Fechamento semanal (demo)', created_at: e });
    commissions.push({ id: `demo-pd-${w}`, client_id: clientId, date: format(addDays(end, 1), 'yyyy-MM-dd'), amount, type: 'paid', note: 'Pagamento (demo)', created_at: e });
  }
  return { assignments, insights, commissions };
}
