/** Sections of the Agency Panel a collaborator can be granted. The owner always has all of them. */
export const AGENCY_PERMISSIONS = [
  { key: 'resumo', label: 'Dashboard', hint: 'Gastos, comissões e fechamento semanal' },
  { key: 'clientes', label: 'Clientes', hint: 'Cadastrar clientes, caução e abrir o painel do cliente' },
  { key: 'contas', label: 'Contas de anúncio', hint: 'Ver contas e atribuir aos clientes' },
  { key: 'tiers', label: 'Tiers & Taxas', hint: 'Criar e excluir faixas de comissão' },
  { key: 'creditos', label: 'Financeiro · Créditos', hint: 'Cauções e repasse à fornecedora' },
  { key: 'suporte', label: 'Suporte', hint: 'Pedidos dos clientes e chamados' },
  { key: 'marca', label: 'Marca & Dados', hint: 'Logo, cor, domínio e WhatsApp' },
  { key: 'juridico', label: 'Jurídico', hint: 'Baixar o termo aceito' },
] as const;

export type AgencyPermission = typeof AGENCY_PERMISSIONS[number]['key'];

/** Sections visible to a user: everything for the owner, only granted ones for a collaborator. */
export function visibleSections(isOwner: boolean, perms: string[] | null | undefined): string[] {
  const all = AGENCY_PERMISSIONS.map(p => p.key as string);
  if (isOwner) return [...all, 'usuarios'];
  const set = new Set(perms || []);
  return all.filter(k => set.has(k));
}

/** Digits-only WhatsApp number (with country code), or null when too short to be valid. */
export function normalizeWhatsapp(raw?: string | null): string | null {
  const d = String(raw || '').replace(/\D/g, '');
  return d.length >= 10 && d.length <= 15 ? d : null;
}
