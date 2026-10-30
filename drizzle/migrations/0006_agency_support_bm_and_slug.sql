ALTER TABLE public.agency_support_tasks ADD COLUMN IF NOT EXISTS bm_id text, ADD COLUMN IF NOT EXISTS account_naming text;
ALTER TABLE public.agency_settings ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS agency_settings_slug_key ON public.agency_settings (lower(slug)) WHERE slug IS NOT NULL;
ALTER TABLE public.agency_sub_clients ADD COLUMN IF NOT EXISTS client_id uuid;
CREATE OR REPLACE FUNCTION public.get_agency_branding(_key text)
RETURNS TABLE(agency_client_id uuid, brand_name text, logo_url text, primary_color text, slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.agency_client_id, s.brand_name, s.logo_url, s.primary_color, s.slug
  FROM public.agency_settings s
  WHERE _key IS NOT NULL AND length(_key) BETWEEN 2 AND 255
    AND (lower(s.slug) = lower(_key) OR lower(s.custom_domain) = lower(_key))
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_agency_branding(text) TO anon, authenticated;