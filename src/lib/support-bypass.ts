// Clientes liberados para abrir pedidos de suporte mesmo com saldo atrasado (> US$ 25).
// Use o id do cliente para não liberar outro cliente com nome parecido por engano.
export const SUPPORT_OVERDUE_BYPASS_CLIENT_IDS = new Set<string>([
  '6c1f1501-33c9-4eb5-a02d-69dfe80ff964', // Bravo Multimarcas (Mateus)
]);

export const SUPPORT_OVERDUE_LIMIT = 25;

export function hasSupportOverdueBypass(client: { id?: string | null; name?: string | null } | null | undefined): boolean {
  if (!client) return false;
  if (client.id && SUPPORT_OVERDUE_BYPASS_CLIENT_IDS.has(client.id)) return true;
  return /emerson/i.test(client.name || '');
}

export function isSupportBlockedByOverdue(
  client: { id?: string | null; name?: string | null } | null | undefined,
  overdue: number,
): boolean {
  return !hasSupportOverdueBypass(client) && overdue > SUPPORT_OVERDUE_LIMIT;
}
