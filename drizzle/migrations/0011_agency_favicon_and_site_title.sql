ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS favicon_url text,
  ADD COLUMN IF NOT EXISTS site_title text;

DROP FUNCTION IF EXISTS public.get_agency_branding(text);
CREATE FUNCTION public.get_agency_branding(_key text)
RETURNS TABLE(agency_client_id uuid, brand_name text, logo_url text, primary_color text, slug text, favicon_url text, site_title text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.agency_client_id, s.brand_name, s.logo_url, s.primary_color, s.slug, s.favicon_url, s.site_title
  FROM public.agency_settings s
  WHERE _key IS NOT NULL AND length(_key) BETWEEN 2 AND 255
    AND (lower(s.slug) = lower(_key) OR lower(s.custom_domain) = lower(_key))
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_agency_branding(text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_client_agency_branding(uuid);
CREATE FUNCTION public.get_client_agency_branding(_client_id uuid)
RETURNS TABLE(agency_client_id uuid, brand_name text, logo_url text, primary_color text, slug text, support_whatsapp text, favicon_url text, site_title text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT st.agency_client_id, st.brand_name, st.logo_url, st.primary_color, st.slug, st.support_whatsapp, st.favicon_url, st.site_title
    FROM public.agency_sub_clients s
    JOIN public.agency_settings st ON st.agency_client_id = s.agency_client_id
   WHERE s.client_id = _client_id
     AND (public.is_staff()
          OR _client_id IN (SELECT c.id FROM public.clients c WHERE c.auth_user_id = auth.uid())
          OR _client_id IN (SELECT public.agency_visible_client_ids()))
   ORDER BY s.created_at
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_client_agency_branding(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_client_agency_branding(uuid) TO authenticated;