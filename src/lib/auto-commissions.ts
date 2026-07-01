import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, format, addDays } from 'date-fns';
import { parseDateLocal } from '@/lib/date-utils';
import { fetchCommissionTiers, getTierPctFromTiers } from '@/lib/commission-tiers';

export interface AutoCommissionResult {
  inserted: number;
  updated: number;
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
export async function syncAutoCommissions(opts?: { logAudit?: boolean; source?: 'manual' | 'auto' }): Promise<AutoCommissionResult> {
  const startedAt = Date.now();
  const result: AutoCommissionResult = { inserted: 0, updated: 0, skipped: 0, errors: 0 };

  const tiers = await fetchCommissionTiers();

  const [clientsRes, assignRes, insightsRes, existingRes] = await Promise.all([
    supabase.from('clients').select('id, client_type, payment_type, percentage_value, fixed_value'),
    supabase.from('meta_ad_account_assignments').select('ad_account_id, client_id, active, effective_from, effective_to').eq('active', true),
    supabase.from('meta_ad_insights').select('ad_account_id, date, spend').limit(50000),
    supabase.from('commissions').select('id, client_id, billing_week_start, amount, ad_spend, valor_pago').eq('type', 'daily').not('billing_week_start', 'is', null),
  ]);

  if (clientsRes.error || assignRes.error || insightsRes.error || existingRes.error) {
    return { inserted: 0, updated: 0, skipped: 0, errors: 1 };
  }

  const clients = (clientsRes.data || []).filter(c => c.client_type !== 'venda');
  const clientById = new Map(clients.map(c => [c.id, c]));

  // ad_account_id -> { client_id, effective_from, effective_to }
  // CRÍTICO: gasto antes de effective_from não pertence ao cliente.
  type Window = { client_id: string; effective_from: string | null; effective_to: string | null };
  const accWindows = new Map<string, Window>();
  (assignRes.data || []).forEach((a: any) => accWindows.set(a.ad_account_id, {
    client_id: a.client_id,
    effective_from: a.effective_from || null,
    effective_to: a.effective_to || null,
  }));

  // existing weeks: first saved commission row by `${client_id}|${billing_week_start}`
  const existing = new Map<string, any>();
  (existingRes.data || []).forEach((c: any) => {
    const key = `${c.client_id}|${c.billing_week_start}`;
    if (!existing.has(key)) existing.set(key, c);
  });

  // Group spend by client + Thu-week
  type WeekKey = string; // yyyy-MM-dd of Thursday
  const spendByClient = new Map<string, Map<WeekKey, number>>();

  (insightsRes.data || []).forEach((i: any) => {
    const win = accWindows.get(i.ad_account_id);
    if (!win) return;
    const clientId = win.client_id;
    if (!clientById.has(clientId)) return;
    // Respeita vigência: ignora gasto anterior à atribuição (ou posterior ao fim)
    const insightDate: string = typeof i.date === 'string' ? i.date.slice(0, 10) : '';
    if (win.effective_from && insightDate < win.effective_from) return;
    if (win.effective_to && insightDate > win.effective_to) return;
    const d = parseDateLocal(i.date);
    const ws = startOfWeek(d, { weekStartsOn: 5 });
    const key = format(ws, 'yyyy-MM-dd');
    if (!spendByClient.has(clientId)) spendByClient.set(clientId, new Map());
    const wmap = spendByClient.get(clientId)!;
    wmap.set(key, (wmap.get(key) || 0) + Number(i.spend || 0));
  });

  // Current week's start (Thu) — skip this incomplete week
  const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 5 }), 'yyyy-MM-dd');

  const inserts: any[] = [];
  const updates: { id: string; patch: any }[] = [];

  for (const [clientId, weeks] of spendByClient.entries()) {
    const client: any = clientById.get(clientId)!;
    const basePct = Number(client.percentage_value) || 0;
    const usesPercentage = client.payment_type === 'percentage' || client.payment_type === 'both';
    if (!usesPercentage || basePct <= 0) continue;

    for (const [weekKey, weekSpend] of weeks.entries()) {
      if (weekKey === currentWeekStart) continue; // open week
      if (weekSpend <= 0) continue;
      const rate = getTierPctFromTiers(weekSpend, basePct, tiers);
      const commission = weekSpend * (rate / 100);
      if (commission <= 0) continue;
      const wsDate = parseDateLocal(weekKey);
      const weekEnd = format(addDays(wsDate, 6), 'yyyy-MM-dd');
      const existingRow = existing.get(`${clientId}|${weekKey}`);
      if (existingRow) {
        const prevAmount = Number(existingRow.amount || 0);
        const prevSpend = Number(existingRow.ad_spend || 0);
        const paid = Number(existingRow.valor_pago || 0);
        const changed = Math.abs(prevAmount - commission) > 0.01 || Math.abs(prevSpend - weekSpend) > 0.01;
        if (!changed) {
          result.skipped++;
          continue;
        }
        const pending = Math.max(0, commission - paid);
        updates.push({
          id: existingRow.id,
          patch: {
            amount: commission,
            ad_spend: weekSpend,
            billing_week_end: weekEnd,
            percentual_aplicado: rate,
            valor_pendente: pending,
            status: pending <= 0 ? 'pago' : paid > 0 ? 'parcial' : 'pendente',
            note: `Auto-atualizada • Gasto Meta ${weekKey} a ${weekEnd}`,
          },
        });
        continue;
      }
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

  for (const u of updates) {
    const { error } = await supabase.from('commissions').update(u.patch).eq('id', u.id);
    if (error) result.errors++;
    else result.updated++;
  }

  if (opts?.logAudit) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('commission_sync_log').insert({
        triggered_by: user?.id ?? null,
        triggered_by_email: user?.email ?? null,
        source: opts.source || 'manual',
        inserted_count: result.inserted,
        skipped_count: result.skipped,
        error_count: result.errors,
        duration_ms: Date.now() - startedAt,
      });
    } catch { /* silent */ }
  }

  return result;
}
