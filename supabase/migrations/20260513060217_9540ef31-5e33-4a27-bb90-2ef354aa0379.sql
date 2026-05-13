
CREATE TABLE IF NOT EXISTS public.client_terms_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  auth_user_id UUID,
  email TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_terms_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/support read terms"
ON public.client_terms_acceptances FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Clients read own terms"
ON public.client_terms_acceptances FOR SELECT TO authenticated
USING (auth_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_terms_client ON public.client_terms_acceptances(client_id);

CREATE TABLE IF NOT EXISTS public.access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID,
  email TEXT,
  role TEXT,
  action TEXT NOT NULL, -- 'signup','login','logout','login_failed'
  ip_address TEXT,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/support read access_logs"
ON public.access_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Users read own access_logs"
ON public.access_logs FOR SELECT TO authenticated
USING (auth_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_access_logs_user ON public.access_logs(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_created ON public.access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_action ON public.access_logs(action);
