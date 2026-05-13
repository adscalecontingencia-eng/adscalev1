
-- Business Managers da agência
CREATE TABLE public.meta_business_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_bm_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contas de Anúncio dentro das BMs
CREATE TABLE public.meta_ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_account_id TEXT NOT NULL UNIQUE,
  bm_id UUID REFERENCES public.meta_business_managers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  account_status INTEGER,
  currency TEXT DEFAULT 'USD',
  amount_spent NUMERIC DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Atribuição de conta -> cliente
CREATE TABLE public.meta_ad_account_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id UUID NOT NULL REFERENCES public.meta_ad_accounts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN DEFAULT true,
  UNIQUE (ad_account_id, client_id)
);

-- Métricas diárias por conta
CREATE TABLE public.meta_ad_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id UUID NOT NULL REFERENCES public.meta_ad_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  spend NUMERIC DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  reach BIGINT DEFAULT 0,
  actions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ad_account_id, date)
);

-- Log de bloqueios
CREATE TABLE public.meta_blocked_accounts_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id UUID NOT NULL REFERENCES public.meta_ad_accounts(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- 'blocked' | 'unblocked'
  reason TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX idx_meta_ad_accounts_bm ON public.meta_ad_accounts(bm_id);
CREATE INDEX idx_meta_assignments_client ON public.meta_ad_account_assignments(client_id);
CREATE INDEX idx_meta_insights_account_date ON public.meta_ad_insights(ad_account_id, date DESC);
CREATE INDEX idx_meta_blocked_account ON public.meta_blocked_accounts_log(ad_account_id, detected_at DESC);

-- RLS
ALTER TABLE public.meta_business_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_account_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_blocked_accounts_log ENABLE ROW LEVEL SECURITY;

-- Admin/Support: full access em tudo
CREATE POLICY "Admin full BMs" ON public.meta_business_managers FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'));

CREATE POLICY "Admin full accounts" ON public.meta_ad_accounts FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'));

CREATE POLICY "Admin full assignments" ON public.meta_ad_account_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'));

CREATE POLICY "Admin full insights" ON public.meta_ad_insights FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'));

CREATE POLICY "Admin full blocked log" ON public.meta_blocked_accounts_log FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'));

-- Cliente: SELECT apenas do que é seu
CREATE POLICY "Clients see own accounts" ON public.meta_ad_accounts FOR SELECT TO authenticated
  USING (id IN (
    SELECT a.ad_account_id FROM public.meta_ad_account_assignments a
    JOIN public.clients c ON c.id = a.client_id
    WHERE c.auth_user_id = auth.uid() AND a.active = true
  ));

CREATE POLICY "Clients see own assignments" ON public.meta_ad_account_assignments FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

CREATE POLICY "Clients see own insights" ON public.meta_ad_insights FOR SELECT TO authenticated
  USING (ad_account_id IN (
    SELECT a.ad_account_id FROM public.meta_ad_account_assignments a
    JOIN public.clients c ON c.id = a.client_id
    WHERE c.auth_user_id = auth.uid() AND a.active = true
  ));

-- Triggers updated_at
CREATE TRIGGER trg_meta_bms_updated BEFORE UPDATE ON public.meta_business_managers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_meta_accounts_updated BEFORE UPDATE ON public.meta_ad_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
