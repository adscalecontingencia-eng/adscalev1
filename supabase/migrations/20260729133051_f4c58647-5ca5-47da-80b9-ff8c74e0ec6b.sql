
CREATE TABLE public.partner_banners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  image_url text NOT NULL,
  link_url text,
  placement text NOT NULL DEFAULT 'both' CHECK (placement IN ('client_dashboard','marketplace','both')),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.partner_banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.partner_banners TO authenticated;
GRANT ALL ON public.partner_banners TO service_role;

ALTER TABLE public.partner_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active banners"
  ON public.partner_banners FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));

CREATE POLICY "Admins and support can insert banners"
  ON public.partner_banners FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));

CREATE POLICY "Admins and support can update banners"
  ON public.partner_banners FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));

CREATE POLICY "Admins and support can delete banners"
  ON public.partner_banners FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));

CREATE TRIGGER update_partner_banners_updated_at
  BEFORE UPDATE ON public.partner_banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
