// Helpers para respeitar a vigência (effective_from / effective_to) das
// atribuições de conta de anúncio a cliente. Garante que gasto fora desse
// período não seja contabilizado para o cliente — bug crítico corrigido em jun/2026.

export interface AssignmentWindow {
  ad_account_id: string;
  client_id: string;
  active?: boolean;
  effective_from?: string | null;
  effective_to?: string | null;
}

/**
 * Retorna o client_id responsável por uma conta de anúncio em uma dada data.
 * Considera apenas atribuições cuja vigência inclui essa data.
 * `insightDate` no formato 'YYYY-MM-DD'.
 */
export function resolveClientForSpend(
  assignments: AssignmentWindow[],
  ad_account_id: string,
  insightDate: string,
): string | null {
  for (const a of assignments) {
    if (a.ad_account_id !== ad_account_id) continue;
    if (a.effective_from && insightDate < a.effective_from) continue;
    if (a.effective_to && insightDate > a.effective_to) continue;
    return a.client_id;
  }
  return null;
}
