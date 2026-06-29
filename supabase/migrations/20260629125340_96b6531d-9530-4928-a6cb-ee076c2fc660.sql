
-- 1) tracking_pixels
CREATE TABLE public.tracking_pixels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('meta','google_ads','google_analytics')),
  pixel_id text NOT NULL,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tracking_pixels TO anon, authenticated;
GRANT ALL ON public.tracking_pixels TO service_role;

ALTER TABLE public.tracking_pixels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read enabled pixels"
  ON public.tracking_pixels FOR SELECT
  USING (enabled = true);

CREATE POLICY "Admin/support can read all pixels"
  ON public.tracking_pixels FOR SELECT
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));

CREATE POLICY "Admin/support can insert pixels"
  ON public.tracking_pixels FOR INSERT
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));

CREATE POLICY "Admin/support can update pixels"
  ON public.tracking_pixels FOR UPDATE
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));

CREATE POLICY "Admin/support can delete pixels"
  ON public.tracking_pixels FOR DELETE
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));

CREATE TRIGGER trg_tracking_pixels_updated
  BEFORE UPDATE ON public.tracking_pixels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Allow marketplace acceptance without a clients row
ALTER TABLE public.client_terms_acceptances
  ALTER COLUMN client_id DROP NOT NULL;
