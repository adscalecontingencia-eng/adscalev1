-- meta_pages
CREATE TABLE public.meta_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_page_id text NOT NULL UNIQUE,
  bm_id uuid REFERENCES public.meta_business_managers(id) ON DELETE SET NULL,
  name text NOT NULL,
  is_published boolean,
  is_restricted boolean DEFAULT false,
  category text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.meta_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full meta_pages" ON public.meta_pages FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'));
CREATE TRIGGER trg_meta_pages_updated BEFORE UPDATE ON public.meta_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- meta_ads
CREATE TABLE public.meta_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_ad_id text NOT NULL UNIQUE,
  ad_account_id uuid REFERENCES public.meta_ad_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  effective_status text,
  status text,
  issues_info jsonb,
  disapproval_reason text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.meta_ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full meta_ads" ON public.meta_ads FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'));
CREATE INDEX idx_meta_ads_account ON public.meta_ads(ad_account_id);
CREATE INDEX idx_meta_ads_status ON public.meta_ads(effective_status);
CREATE TRIGGER trg_meta_ads_updated BEFORE UPDATE ON public.meta_ads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- meta_critical_events
CREATE TABLE public.meta_critical_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('account_banned','bm_restricted','ad_rejected','page_banned')),
  severity text NOT NULL DEFAULT 'critical' CHECK (severity IN ('critical','high','medium')),
  client_id uuid,
  ad_account_id uuid,
  bm_id uuid,
  entity_type text NOT NULL,
  entity_meta_id text NOT NULL,
  entity_name text,
  reason text,
  details jsonb DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  notify_status text NOT NULL DEFAULT 'pending' CHECK (notify_status IN ('pending','sent','failed','skipped')),
  dispatch_log_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_critical_event_daily ON public.meta_critical_events
  (event_type, entity_meta_id, ((detected_at AT TIME ZONE 'UTC')::date));
CREATE INDEX idx_critical_events_client ON public.meta_critical_events(client_id);
CREATE INDEX idx_critical_events_status ON public.meta_critical_events(notify_status);
CREATE INDEX idx_critical_events_detected ON public.meta_critical_events(detected_at DESC);

ALTER TABLE public.meta_critical_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full critical events" ON public.meta_critical_events FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'));
CREATE POLICY "Clients read own critical events" ON public.meta_critical_events FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

-- whatsapp_dispatch_log: permite INSERT via service role (já é o caso) e adiciona policy explícita p/ admins inserirem manualmente se necessário
CREATE POLICY "Admin insert whatsapp_dispatch_log" ON public.whatsapp_dispatch_log FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'));