import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, format, addDays } from 'date-fns';
import { parseDateLocal } from '@/lib/date-utils';
import { fetchCommissionTiers, getTierPctFromTiers } from '@/lib/commission-tiers';

export interface AutoCommissionResult {
  inserted: number;
  skipped: number;
  errors: number;
}

/**
 * Scans synced ad spend (meta_ad_insights) per client and creates
 * pending commission rows (type='daily', status='pendente') for each
 * completed Thursday→Wednesday week that doesn't yet have one.
 *
 * Only commission percentage clients (payment_type includes percentage)
 * of client_type 'aluguel' are processed. The current week (still open)
 * is skipped because Saturday's spend isn't closed yet.
 */
export async function syncAutoCommissions(): Promise<AutoCommissionResult> {
  const result: AutoCommissionResult = { inserted: 0, skipped: 0, errors: 0 };

  const [clientsRes, assignRes, insightsRes, existingRes] = await Promise.all([
    supabase.from('clients').select('id, client_type, payment_type, percentage_value, fixed_value'),
    supabase.from('meta_ad_account_assignments').select('ad_account_id, client_id, active').eq('active', true),
    supabase.from('meta_ad_insights').select('ad_account_id, date, spend').limit(50000),
    supabase.from('commissions').select('id, client_id, billing_week_start').eq('type', 'daily').not('billing_week_start', 'is', null),
  ]);

  if (clientsRes.error || assignRes.error || insightsRes.error || existingRes.error) {
    return { inserted: 0, skipped: 0, errors: 1 };
  }

  const clients = (clientsRes.data || []).filter(c => c.client_type !== 'venda');
  const clientById = new Map(clients.map(c => [c.id, c]));

  // ad_account_id -> client_id (active only)
  const accToClient = new Map<string, string>();
  (assignRes.data || []).forEach(a => accToClient.set(a.ad_account_id, a.client_id));

  // existing weeks: set of `${client_id}|${billing_week_start}`
  const existing = new Set<string>();
  (existingRes.data || []).forEach((c: any) => {
    existing.add(`${c.client_id}|${c.billing_week_start}`);
  });

  // Group spend by client + Thu-week
  type WeekKey = string; // yyyy-MM-dd of Thursday
  const spendByClient = new Map<string, Map<WeekKey, number>>();

  (insightsRes.data || []).forEach((i: any) => {
    const clientId = accToClient.get(i.ad_account_id);
    if (!clientId || !clientById.has(clientId)) return;
    const d = parseDateLocal(i.date);
    const ws = startOfWeek(d, { weekStartsOn: 4 });
    const key = format(ws, 'yyyy-MM-dd');
    if (!spendByClient.has(clientId)) spendByClient.set(clientId, new Map());
    const wmap = spendByClient.get(clientId)!;
    wmap.set(key, (wmap.get(key) || 0) + Number(i.spend || 0));
  });

  // Current week's start (Thu) — skip this incomplete week
  const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 4 }), 'yyyy-MM-dd');

  const inserts: any[] = [];

  for (const [clientId, weeks] of spendByClient.entries()) {
    const client: any = clientById.get(clientId)!;
    const basePct = Number(client.percentage_value) || 0;
    const usesPercentage = client.payment_type === 'percentage' || client.payment_type === 'both';
    if (!usesPercentage || basePct <= 0) continue;

    for (const [weekKey, weekSpend] of weeks.entries()) {
      if (weekKey === currentWeekStart) continue; // open week
      if (weekSpend <= 0) continue;
      if (existing.has(`${clientId}|${weekKey}`)) {
        result.skipped++;
        continue;
      }
      const rate = getTierPct(weekSpend, basePct);
      const commission = weekSpend * (rate / 100);
      if (commission <= 0) continue;
      const wsDate = parseDateLocal(weekKey);
      const weekEnd = format(addDays(wsDate, 6), 'yyyy-MM-dd');
      inserts.push({
        client_id: clientId,
        date: wsDate.toISOString(),
        amount: commission,
        ad_spend: weekSpend,
        type: 'daily',
        billing_week_start: weekKey,
        billing_week_end: weekEnd,
        percentual_aplicado: rate,
        valor_pago: 0,
        valor_pendente: commission,
        status: 'pendente',
        note: `Auto-gerada • Gasto sincronizado ${weekKey} a ${weekEnd}`,
      });
    }
  }

  if (inserts.length > 0) {
    // chunk inserts to be safe
    const chunkSize = 200;
    for (let i = 0; i < inserts.length; i += chunkSize) {
      const chunk = inserts.slice(i, i + chunkSize);
      const { error } = await supabase.from('commissions').insert(chunk);
      if (error) result.errors++;
      else result.inserted += chunk.length;
    }
  }

  return result;
}
