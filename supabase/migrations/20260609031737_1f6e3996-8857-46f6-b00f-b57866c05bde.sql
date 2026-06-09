
-- 1) Perfis vinculados a cada BM (cadastro manual pelo suporte)
CREATE TABLE public.bm_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bm_id uuid NOT NULL REFERENCES public.meta_business_managers(id) ON DELETE CASCADE,
  profile_name text NOT NULL,
  profile_role text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bm_id, profile_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bm_profiles TO authenticated;
GRANT ALL ON public.bm_profiles TO service_role;
ALTER TABLE public.bm_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/support full bm_profiles" ON public.bm_profiles
  TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'support'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'support'::app_role));
CREATE TRIGGER trg_bm_profiles_updated BEFORE UPDATE ON public.bm_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Registro diário de atividades / disponibilidade de BMs
CREATE TABLE public.bm_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bm_id uuid REFERENCES public.meta_business_managers(id) ON DELETE SET NULL,
  activity_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  availability text NOT NULL DEFAULT 'disponivel', -- disponivel | parcial | indisponivel | bloqueada
  accounts_available int DEFAULT 0,
  activity_notes text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bm_activity_log TO authenticated;
GRANT ALL ON public.bm_activity_log TO service_role;
ALTER TABLE public.bm_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/support full bm_activity_log" ON public.bm_activity_log
  TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'support'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'support'::app_role));
CREATE INDEX idx_bm_activity_log_date ON public.bm_activity_log (activity_date DESC);
CREATE INDEX idx_bm_activity_log_bm ON public.bm_activity_log (bm_id);
CREATE TRIGGER trg_bm_activity_log_updated BEFORE UPDATE ON public.bm_activity_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Marcador de leitura de notificações por cliente (auth_user_id)
CREATE TABLE public.client_notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES public.meta_critical_events(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auth_user_id, event_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_notification_reads TO authenticated;
GRANT ALL ON public.client_notification_reads TO service_role;
ALTER TABLE public.client_notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User manages own reads" ON public.client_notification_reads
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
