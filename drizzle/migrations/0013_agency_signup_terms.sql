ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS signup_terms_pt text,
  ADD COLUMN IF NOT EXISTS signup_terms_en text,
  ADD COLUMN IF NOT EXISTS signup_terms_version text,
  ADD COLUMN IF NOT EXISTS signup_terms_updated_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_agency_signup_terms(_key text)
RETURNS TABLE(agency_client_id uuid, brand_name text, terms_pt text, terms_en text, terms_version text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT s.agency_client_id, s.brand_name, s.signup_terms_pt, s.signup_terms_en, s.signup_terms_version
  FROM public.agency_settings s
  WHERE _key IS NOT NULL AND length(_key) BETWEEN 2 AND 255
    AND (lower(s.slug) = lower(_key) OR lower(s.custom_domain) = lower(_key))
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_agency_signup_terms(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agency_signup_terms(text) TO anon, authenticated, service_role;