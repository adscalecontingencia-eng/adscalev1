ALTER TABLE public.meta_pages
  ADD COLUMN IF NOT EXISTS followers_count bigint,
  ADD COLUMN IF NOT EXISTS fan_count bigint,
  ADD COLUMN IF NOT EXISTS created_time timestamptz,
  ADD COLUMN IF NOT EXISTS picture_url text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

CREATE UNIQUE INDEX IF NOT EXISTS meta_pages_meta_page_id_key ON public.meta_pages (meta_page_id);

CREATE TABLE IF NOT EXISTS public.meta_page_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL,
  client_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS meta_page_assignments_one_active_per_page
  ON public.meta_page_assignments (page_id) WHERE active = true;

CREATE INDEX IF NOT EXISTS meta_page_assignments_client_idx ON public.meta_page_assignments (client_id);

ALTER TABLE public.meta_page_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full page assignments" ON public.meta_page_assignments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Clients see own page assignments" ON public.meta_page_assignments
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

CREATE POLICY "Clients see own pages" ON public.meta_pages
  FOR SELECT TO authenticated
  USING (id IN (
    SELECT a.page_id FROM public.meta_page_assignments a
    JOIN public.clients c ON c.id = a.client_id
    WHERE c.auth_user_id = auth.uid() AND a.active = true
  ));