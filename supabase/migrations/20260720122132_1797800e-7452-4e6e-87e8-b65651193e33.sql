
CREATE TABLE public.manual_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_email text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text,
  adjustment_type text NOT NULL,
  ad_account_ids text[] DEFAULT '{}',
  ad_account_names text[] DEFAULT '{}',
  period_start date,
  period_end date,
  previous_value numeric,
  new_value numeric,
  delta numeric GENERATED ALWAYS AS (COALESCE(new_value,0) - COALESCE(previous_value,0)) STORED,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb
);

GRANT SELECT, INSERT ON public.manual_adjustments TO authenticated;
GRANT ALL ON public.manual_adjustments TO service_role;

ALTER TABLE public.manual_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/support can view manual adjustments"
  ON public.manual_adjustments FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'support'::app_role));

CREATE POLICY "Admin/support can insert manual adjustments"
  ON public.manual_adjustments FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'support'::app_role));

CREATE INDEX idx_manual_adjustments_created_at ON public.manual_adjustments (created_at DESC);
CREATE INDEX idx_manual_adjustments_client ON public.manual_adjustments (client_id, created_at DESC);
