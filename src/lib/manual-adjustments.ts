import { supabase } from '@/integrations/supabase/client';

export interface ManualAdjustmentInput {
  client_id?: string | null;
  client_name?: string | null;
  adjustment_type: string; // e.g. 'insights_backfill', 'commission_override', 'balance_correction'
  ad_account_ids?: string[];
  ad_account_names?: string[];
  period_start?: string | null;
  period_end?: string | null;
  previous_value?: number | null;
  new_value?: number | null;
  reason?: string | null;
  metadata?: Record<string, any>;
}

export async function logManualAdjustment(input: ManualAdjustmentInput) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('manual_adjustments').insert({
      performed_by: user?.id ?? null,
      performed_by_email: user?.email ?? null,
      client_id: input.client_id ?? null,
      client_name: input.client_name ?? null,
      adjustment_type: input.adjustment_type,
      ad_account_ids: input.ad_account_ids ?? [],
      ad_account_names: input.ad_account_names ?? [],
      period_start: input.period_start ?? null,
      period_end: input.period_end ?? null,
      previous_value: input.previous_value ?? null,
      new_value: input.new_value ?? null,
      reason: input.reason ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) console.warn('logManualAdjustment failed', error);
  } catch (e) {
    console.warn('logManualAdjustment exception', e);
  }
}

export const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  insights_backfill: 'Backfill de gastos',
  commission_override: 'Ajuste de comissão',
  balance_correction: 'Correção de saldo',
  payment_manual: 'Pagamento manual',
  other: 'Outro',
};
