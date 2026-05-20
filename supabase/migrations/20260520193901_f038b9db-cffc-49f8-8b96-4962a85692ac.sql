
CREATE TABLE public.commission_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  min_spend NUMERIC NOT NULL,
  pct NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view tiers"
  ON public.commission_tiers FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage tiers insert"
  ON public.commission_tiers FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage tiers update"
  ON public.commission_tiers FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage tiers delete"
  ON public.commission_tiers FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_commission_tiers_updated_at
  BEFORE UPDATE ON public.commission_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.commission_tiers (min_spend, pct) VALUES
  (20000, 4),
  (40000, 3),
  (80000, 2),
  (200000, 1);
