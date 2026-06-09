ALTER TABLE public.meta_sync_jobs REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_sync_jobs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;