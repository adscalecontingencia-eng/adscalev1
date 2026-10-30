CREATE TABLE public.agency_support_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sub_client_id uuid REFERENCES public.agency_sub_clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'manutencao',
  structure_type text NOT NULL DEFAULT 'BM Comum',
  status text NOT NULL DEFAULT 'pendente',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_support_tasks TO authenticated;
GRANT ALL ON public.agency_support_tasks TO service_role;
ALTER TABLE public.agency_support_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agency owner or staff manage support tasks" ON public.agency_support_tasks
  FOR ALL TO authenticated
  USING (public.is_agency_owner(agency_client_id) OR public.is_staff())
  WITH CHECK (public.is_agency_owner(agency_client_id) OR public.is_staff());
CREATE TRIGGER trg_agency_support_tasks_updated BEFORE UPDATE ON public.agency_support_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX ON public.agency_support_tasks(agency_client_id, status);