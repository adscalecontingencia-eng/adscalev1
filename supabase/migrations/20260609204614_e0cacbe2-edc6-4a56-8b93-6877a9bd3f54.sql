
ALTER TABLE public.internal_tasks
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS due_date date;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'internal_tasks_scope_chk') THEN
    ALTER TABLE public.internal_tasks ADD CONSTRAINT internal_tasks_scope_chk CHECK (scope IN ('cliente','agencia'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'internal_tasks_priority_chk') THEN
    ALTER TABLE public.internal_tasks ADD CONSTRAINT internal_tasks_priority_chk CHECK (priority IN ('baixa','media','alta','urgente'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_internal_tasks_scope ON public.internal_tasks(scope);

ALTER TABLE public.bm_profiles
  ADD COLUMN IF NOT EXISTS meta_user_id text,
  ADD COLUMN IF NOT EXISTS meta_user_kind text,
  ADD COLUMN IF NOT EXISTS is_whitelisted boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.bm_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  kind text,
  description text,
  last_verified_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bm_backups TO authenticated;
GRANT ALL ON public.bm_backups TO service_role;
ALTER TABLE public.bm_backups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin/support full bm_backups" ON public.bm_backups;
CREATE POLICY "Admin/support full bm_backups" ON public.bm_backups
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));
DROP TRIGGER IF EXISTS trg_bm_backups_updated ON public.bm_backups;
CREATE TRIGGER trg_bm_backups_updated BEFORE UPDATE ON public.bm_backups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.bm_backup_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bm_id uuid NOT NULL REFERENCES public.meta_business_managers(id) ON DELETE CASCADE,
  backup_id uuid NOT NULL REFERENCES public.bm_backups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bm_id, backup_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bm_backup_assignments TO authenticated;
GRANT ALL ON public.bm_backup_assignments TO service_role;
ALTER TABLE public.bm_backup_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin/support full bm_backup_assignments" ON public.bm_backup_assignments;
CREATE POLICY "Admin/support full bm_backup_assignments" ON public.bm_backup_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));

CREATE TABLE IF NOT EXISTS public.support_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_settings TO authenticated;
GRANT ALL ON public.support_settings TO service_role;
ALTER TABLE public.support_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin/support settings" ON public.support_settings;
CREATE POLICY "Admin/support settings" ON public.support_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));

INSERT INTO public.support_settings(key, value)
VALUES ('min_backups_per_bm', '2'::jsonb)
ON CONFLICT (key) DO NOTHING;
