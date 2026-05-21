-- Audit log genérico
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  actor_role text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  before jsonb,
  after jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/support read audit_log"
ON public.audit_log FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role));
CREATE POLICY "Admin/support insert audit_log"
ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role));
CREATE INDEX idx_audit_log_created_at ON public.audit_log (created_at DESC);
CREATE INDEX idx_audit_log_entity ON public.audit_log (entity, entity_id);

-- Tarefas internas (migrar do localStorage)
CREATE TABLE public.internal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'manutencao',
  structure_type text NOT NULL DEFAULT 'BM Comum',
  assigned_to uuid,
  client_id uuid,
  status text NOT NULL DEFAULT 'pendente',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.internal_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/support full internal_tasks"
ON public.internal_tasks FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role));
CREATE TRIGGER trg_internal_tasks_updated_at
BEFORE UPDATE ON public.internal_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_internal_tasks_status ON public.internal_tasks (status);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_critical_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_tasks;
ALTER TABLE public.support_requests REPLICA IDENTITY FULL;
ALTER TABLE public.meta_critical_events REPLICA IDENTITY FULL;
ALTER TABLE public.internal_tasks REPLICA IDENTITY FULL;