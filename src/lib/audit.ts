import { supabase } from '@/integrations/supabase/client';

export interface AuditEntry {
  action: string;
  entity: string;
  entity_id?: string | null;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  metadata?: Record<string, any>;
}

/**
 * Registra uma ação sensível no audit_log. Silencioso em caso de erro
 * para não bloquear o fluxo principal da aplicação.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    let actor_role: string | null = null;
    if (user?.id) {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .limit(1);
      actor_role = roles?.[0]?.role ?? null;
    }
    await supabase.from('audit_log').insert({
      actor_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      actor_role,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entity_id ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch (err) {
    console.warn('[audit] failed', err);
  }
}
