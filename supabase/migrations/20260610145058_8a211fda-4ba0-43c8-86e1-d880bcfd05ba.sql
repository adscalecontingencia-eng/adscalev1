
-- Responsáveis por área
CREATE TABLE public.area_responsibles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL CHECK (area IN ('pages','meta_connections')),
  support_user_id uuid NOT NULL REFERENCES public.support_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (area, support_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.area_responsibles TO authenticated;
GRANT ALL ON public.area_responsibles TO service_role;
ALTER TABLE public.area_responsibles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/support manage responsibles" ON public.area_responsibles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));

-- Notas livres em BMs
CREATE TABLE public.bm_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bm_id uuid REFERENCES public.meta_business_managers(id) ON DELETE SET NULL,
  content text NOT NULL,
  author_id uuid,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bm_notes_created_at_idx ON public.bm_notes (created_at DESC);
CREATE INDEX bm_notes_bm_id_idx ON public.bm_notes (bm_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bm_notes TO authenticated;
GRANT ALL ON public.bm_notes TO service_role;
ALTER TABLE public.bm_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/support manage bm notes" ON public.bm_notes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));
