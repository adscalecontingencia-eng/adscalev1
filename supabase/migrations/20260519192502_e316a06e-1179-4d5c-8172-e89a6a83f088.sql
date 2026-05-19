
CREATE TABLE public.meta_sync_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress_current INTEGER NOT NULL DEFAULT 0,
  progress_total INTEGER NOT NULL DEFAULT 0,
  synced_count INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/support read sync jobs"
  ON public.meta_sync_jobs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Admin/support write sync jobs"
  ON public.meta_sync_jobs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role));

CREATE TRIGGER meta_sync_jobs_updated_at
  BEFORE UPDATE ON public.meta_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_sync_jobs;
