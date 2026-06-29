CREATE TABLE IF NOT EXISTS public.marketplace_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  whatsapp text NOT NULL,
  source text NOT NULL DEFAULT 'aluguel-de-contas',
  user_agent text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_leads_created_at_idx ON public.marketplace_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_leads_email_idx ON public.marketplace_leads(email);
GRANT INSERT ON public.marketplace_leads TO anon, authenticated;
GRANT SELECT ON public.marketplace_leads TO authenticated;
GRANT ALL ON public.marketplace_leads TO service_role;
ALTER TABLE public.marketplace_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can insert leads" ON public.marketplace_leads FOR INSERT TO anon, authenticated WITH CHECK (length(name) BETWEEN 2 AND 120 AND length(email) BETWEEN 5 AND 200 AND length(whatsapp) BETWEEN 6 AND 30);
CREATE POLICY "Admins read leads" ON public.marketplace_leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role));