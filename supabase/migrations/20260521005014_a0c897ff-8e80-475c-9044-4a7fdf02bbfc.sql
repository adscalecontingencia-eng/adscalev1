CREATE TABLE public.commission_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by uuid,
  triggered_by_email text,
  source text NOT NULL DEFAULT 'manual',
  inserted_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  duration_ms integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/support read sync log"
ON public.commission_sync_log FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Admin/support insert sync log"
ON public.commission_sync_log FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role));

CREATE INDEX idx_commission_sync_log_created_at ON public.commission_sync_log (created_at DESC);