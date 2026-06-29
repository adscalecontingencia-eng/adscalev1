ALTER TABLE public.marketplace_leads
  ADD COLUMN IF NOT EXISTS niche text,
  ADD COLUMN IF NOT EXISTS weekly_investment_usd numeric(12,2),
  ADD COLUMN IF NOT EXISTS scheduled_call_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text;

DROP POLICY IF EXISTS "Public can insert leads" ON public.marketplace_leads;
CREATE POLICY "Public can insert leads"
  ON public.marketplace_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(name) BETWEEN 2 AND 120
    AND length(email) BETWEEN 5 AND 200
    AND length(whatsapp) BETWEEN 6 AND 30
    AND (niche IS NULL OR length(niche) <= 120)
    AND (notes IS NULL OR length(notes) <= 1000)
  );