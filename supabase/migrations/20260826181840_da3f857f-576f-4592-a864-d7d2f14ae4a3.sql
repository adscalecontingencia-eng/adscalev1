CREATE TABLE public.billing_week_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  total_spend numeric NOT NULL DEFAULT 0,
  commission_pct numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  timezone_note text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  closed_by uuid,
  closed_by_email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_week_snapshots TO authenticated;
GRANT ALL ON public.billing_week_snapshots TO service_role;

ALTER TABLE public.billing_week_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage billing snapshots"
ON public.billing_week_snapshots FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Support can view billing snapshots"
ON public.billing_week_snapshots FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'support'));

CREATE POLICY "Clients can view own billing snapshots"
ON public.billing_week_snapshots FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.clients c
  WHERE c.id = billing_week_snapshots.client_id
    AND c.auth_user_id = auth.uid()
));

CREATE INDEX idx_billing_week_snapshots_client_week
  ON public.billing_week_snapshots (client_id, week_start DESC);

CREATE TRIGGER trg_billing_week_snapshots_updated_at
BEFORE UPDATE ON public.billing_week_snapshots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();