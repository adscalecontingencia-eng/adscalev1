
-- Whitelist global de perfis "meus" (identificados pelo meta_user_id imutável)
CREATE TABLE public.meta_user_whitelist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_user_id text NOT NULL UNIQUE,
  display_name text NOT NULL,
  meta_user_kind text,
  backup_id uuid REFERENCES public.bm_backups(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_user_whitelist TO authenticated;
GRANT ALL ON public.meta_user_whitelist TO service_role;
ALTER TABLE public.meta_user_whitelist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage whitelist" ON public.meta_user_whitelist FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));
CREATE TRIGGER trg_meta_user_whitelist_updated BEFORE UPDATE ON public.meta_user_whitelist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cache de usuários detectados em cada BM (preenchido pelo scan)
CREATE TABLE public.bm_detected_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bm_id uuid NOT NULL REFERENCES public.meta_business_managers(id) ON DELETE CASCADE,
  meta_user_id text NOT NULL,
  user_name text,
  user_email text,
  user_role text,
  user_kind text,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bm_id, meta_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bm_detected_users TO authenticated;
GRANT ALL ON public.bm_detected_users TO service_role;
ALTER TABLE public.bm_detected_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read detected" ON public.bm_detected_users FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));
CREATE POLICY "staff write detected" ON public.bm_detected_users FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));

CREATE INDEX idx_bm_detected_users_meta ON public.bm_detected_users(meta_user_id);
CREATE INDEX idx_bm_detected_users_bm ON public.bm_detected_users(bm_id);
