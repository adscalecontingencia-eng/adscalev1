CREATE OR REPLACE FUNCTION public.get_client_agency_branding(_client_id uuid)
RETURNS TABLE(agency_client_id uuid, brand_name text, logo_url text, primary_color text, slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT st.agency_client_id, st.brand_name, st.logo_url, st.primary_color, st.slug
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