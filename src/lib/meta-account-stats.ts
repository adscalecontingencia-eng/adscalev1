// Regras de contagem do painel de Conexões Meta.
// Só entram contas NÃO arquivadas, devolvidas pela Meta na última sincronização
// (até 24h antes da conta mais recente) e sem erro de permissão.
export const PERMISSION_ERROR_CODES = [200, 190, 10, 100];

export type StatsAccount = {
  id: string;
  status: string | null;
  last_synced_at?: string | null;
  last_sync_error_code?: number | string | null;
  archived_at?: string | null;
};
export type StatsAssignment = { ad_account_id: string; client_id: string; active?: boolean };

export function liveAccounts<T extends StatsAccount>(accounts: T[]): T[] {
  const notArchived = accounts.filter((a) => !a.archived_at);
  const times = notArchived
    .map((a) => (a.last_synced_at ? new Date(a.last_synced_at).getTime() : 0))
    .filter(Boolean);
  if (!times.length) return [];
  const cutoff = Math.max(...times) - 24 * 60 * 60 * 1000;
  return notArchived.filter((a) => {
    if (PERMISSION_ERROR_CODES.includes(Number(a.last_sync_error_code))) return false;
    if (!a.last_synced_at) return false;
    return new Date(a.last_synced_at).getTime() >= cutoff;
  });
}

export function computeMetaStats(live: StatsAccount[], assignments: StatsAssignment[]) {
  const ids = new Set(live.map((a) => a.id));
  const assignedIds = new Set(
    assignments.filter((a) => a.active !== false && ids.has(a.ad_account_id)).map((a) => a.ad_account_id),
  );
  const active = live.filter((a) => a.status === "active").length;
  return {
    total: live.length,
    active,
    blocked: live.length - active,
    assigned: assignedIds.size,
    unassigned: live.length - assignedIds.size,
  };
}
