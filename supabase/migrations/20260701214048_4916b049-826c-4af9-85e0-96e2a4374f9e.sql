CREATE TABLE public.meta_diagnostics_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_app_id uuid REFERENCES public.meta_apps(id) ON DELETE CASCADE,
  operation text NOT NULL,
  endpoint text,
  http_status int,
  fb_error jsonb,
  summary jsonb,
  logs jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.meta_diagnostics_log TO authenticated;
GRANT ALL ON public.meta_diagnostics_log TO service_role;

ALTER TABLE public.meta_diagnostics_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read diagnostics"
  ON public.meta_diagnostics_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_meta_diag_app_created ON public.meta_diagnostics_log(meta_app_id, created_at DESC);