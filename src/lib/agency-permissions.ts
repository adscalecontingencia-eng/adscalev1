import { tr } from '@/i18n';

/** Sections of the Agency Panel a collaborator can be granted. The owner always has all of them. */
export const AGENCY_PERMISSIONS = [
  { key: 'resumo', get label() { return tr('agency.perm.resumo.label'); }, get hint() { return tr('agency.perm.resumo.hint'); } },
  { key: 'clientes', get label() { return tr('agency.perm.clientes.label'); }, get hint() { return tr('agency.perm.clientes.hint'); } },
  { key: 'contas', get label() { return tr('agency.perm.contas.label'); }, get hint() { return tr('agency.perm.contas.hint'); } },
  { key: 'tiers', get label() { return tr('agency.perm.tiers.label'); }, get hint() { return tr('agency.perm.tiers.hint'); } },
  { key: 'creditos', get label() { return tr('agency.perm.creditos.label'); }, get hint() { return tr('agency.perm.creditos.hint'); } },
  { key: 'suporte', get label() { return tr('agency.perm.suporte.label'); }, get hint() { return tr('agency.perm.suporte.hint'); } },
  { key: 'marca', get label() { return tr('agency.perm.marca.label'); }, get hint() { return tr('agency.perm.marca.hint'); } },
  { key: 'juridico', get label() { return tr('agency.perm.juridico.label'); }, get hint() { return tr('agency.perm.juridico.hint'); } },
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
